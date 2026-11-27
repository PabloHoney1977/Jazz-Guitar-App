# StoreKit — one store.yml per app → App Store + Google Play metadata.
#
# Plain Ruby (yaml + fileutils only) so it can be tested without fastlane.
# The Fastfile calls into this; nothing here talks to Apple or Google.

require "yaml"
require "json"
require "fileutils"

# Store text is UTF-8 whatever the machine locale is (Windows, minimal CI images).
Encoding.default_external = Encoding::UTF_8

module StoreKit
  # Apple limits are characters except keywords (bytes). Google limits are characters.
  IOS_LIMITS = {
    "name" => 30, "subtitle" => 30, "promotional_text" => 170,
    "description" => 4000, "release_notes" => 4000
  }.freeze
  IOS_KEYWORDS_BYTES = 100
  ANDROID_LIMITS = { "title" => 30, "short_description" => 80, "full_description" => 4000 }.freeze
  ANDROID_CHANGELOG = 500

  # Screenshot sizes App Store Connect currently accepts (portrait; landscape = swapped).
  IOS_SIZES = {
    [1320, 2868] => "iPhone 6.9\"", [1290, 2796] => "iPhone 6.7\"", [1260, 2736] => "iPhone 6.9\"",
    [1242, 2688] => "iPhone 6.5\"", [1284, 2778] => "iPhone 6.5\"", [1206, 2622] => "iPhone 6.3\"",
    [1179, 2556] => "iPhone 6.1\"", [1170, 2532] => "iPhone 6.1\"", [1242, 2208] => "iPhone 5.5\"",
    [2064, 2752] => "iPad 13\"", [2048, 2732] => "iPad 12.9\"", [1668, 2420] => "iPad 11\"",
    [1668, 2388] => "iPad 11\"", [1640, 2360] => "iPad 11\""
  }.freeze

  IOS_LOCALIZED_URLS = %w[support_url marketing_url privacy_url].freeze
  REVIEW_FIELDS = %w[first_name last_name phone_number email_address demo_user demo_password notes].freeze
  PLACEHOLDER = /\bTODO\b/

  module_function

  def load(path)
    raise "store.yml not found at #{path}" unless File.exist?(path)
    cfg = YAML.safe_load(File.read(path), aliases: true) || {}
    cfg["listings"] ||= {}
    cfg
  end

  # --- validation --------------------------------------------------------

  # Returns [errors, warnings]. Errors block uploads; warnings don't.
  def validate(cfg, root: nil, platforms: %w[ios android])
    errors = []
    warnings = []
    app = cfg["app"] || {}
    ios_on = platforms.include?("ios") && present?(app["ios_bundle_id"])
    and_on = platforms.include?("android") && present?(app["android_package"])
    if platforms == ["ios"] && !ios_on
      errors << "app.ios_bundle_id is empty — this app isn't set up for the App Store"
    elsif platforms == ["android"] && !and_on
      errors << "app.android_package is empty — this app isn't set up for Google Play"
    elsif !ios_on && !and_on
      errors << "app: set ios_bundle_id and/or android_package"
    end
    errors << "listings: add at least one locale (e.g. en-US)" if cfg["listings"].empty?

    walk(cfg) { |where, v| errors << "#{where}: still contains TODO" if v.is_a?(String) && v =~ PLACEHOLDER }

    cfg["listings"].each do |locale, l|
      l ||= {}
      if ios_on
        %w[name description].each { |k| errors << "#{locale}.#{k}: required for the App Store" unless present?(l[k]) }
        IOS_LIMITS.each do |k, max|
          n = chars(l[k])
          errors << "#{locale}.#{k}: #{n}/#{max} characters (App Store limit)" if n > max
        end
        kb = keywords(l["keywords"]).bytesize
        errors << "#{locale}.keywords: #{kb}/#{IOS_KEYWORDS_BYTES} bytes (App Store limit)" if kb > IOS_KEYWORDS_BYTES
        if l["keywords"].is_a?(String) && l["keywords"] =~ /,\s/
          warnings << "#{locale}.keywords: spaces after commas waste bytes (they're stripped on upload)"
        end
        warnings << "#{locale}.subtitle: empty — it's indexed for search, worth filling" unless present?(l["subtitle"])
      end
      if and_on
        a = android_listing(l)
        errors << "#{locale}.android.short_description: required for Google Play" unless present?(a["short_description"])
        ANDROID_LIMITS.each do |k, max|
          n = chars(a[k])
          errors << "#{locale}.android.#{k}: #{n}/#{max} characters (Google Play limit)" if n > max
        end
        n = chars(l["release_notes"])
        errors << "#{locale}.release_notes: #{n}/#{ANDROID_CHANGELOG} characters (Google Play limit)" if n > ANDROID_CHANGELOG
      end
    end

    urls = (cfg["urls"] || {})
    if ios_on
      errors << "urls.privacy_url: required" unless present?(urls["privacy_url"])
      errors << "urls.support_url: required for the App Store" unless present?(urls["support_url"])
    end
    urls.each { |k, v| errors << "urls.#{k}: must start with https://" if present?(v) && !v.start_with?("https://") }

    if root
      shot_errors, shot_warnings = check_screenshots(cfg, root, ios_on, and_on)
      errors.concat(shot_errors)
      warnings.concat(shot_warnings)
    end
    [errors, warnings]
  end

  def check_screenshots(cfg, root, ios_on, and_on)
    errors = []
    warnings = []
    cfg["listings"].each_key do |locale|
      if ios_on
        dir = File.join(root, "store/screenshots/ios", locale)
        shots = pngs(dir)
        groups = Hash.new(0)
        shots.each do |f|
          w, h = png_size(f)
          label = IOS_SIZES[[w, h].sort] if w && h
          if label.nil?
            errors << "#{rel(f, root)}: #{w}x#{h} isn't an App Store screenshot size"
          else
            groups[label] += 1
          end
        end
        groups.each { |g, n| errors << "ios #{locale} #{g}: #{n} screenshots (max 10)" if n > 10 }
        warnings << "ios #{locale}: no screenshots in #{rel(dir, root)} — existing ones on the store are left alone" if shots.empty?
      end
      next unless and_on

      base = File.join(root, "store/screenshots/android", locale)
      phone = pngs(File.join(base, "phone")) + Dir[File.join(base, "phone", "*.{jpg,jpeg}")]
      if phone.any? && !(2..8).cover?(phone.size)
        errors << "android #{locale} phone: #{phone.size} screenshots (Google needs 2–8)"
      end
      phone.select { |f| f.end_with?(".png") }.each do |f|
        w, h = png_size(f)
        next unless w
        errors << "#{rel(f, root)}: #{w}x#{h} — sides must be 320–3840px" unless [w, h].all? { |d| d.between?(320, 3840) }
        errors << "#{rel(f, root)}: #{w}x#{h} — long side can't exceed 2× the short side" if [w, h].max > 2 * [w, h].min
      end
      { "icon.png" => [512, 512], "feature.png" => [1024, 500] }.each do |name, size|
        f = File.join(base, name)
        next unless File.exist?(f)
        errors << "#{rel(f, root)}: must be #{size.join('x')}" unless png_size(f) == size
      end
      warnings << "android #{locale}: no phone screenshots in #{rel(base, root)}/phone" if phone.empty?
    end
    [errors, warnings]
  end

  # --- writers -----------------------------------------------------------

  # fastlane deliver layout: <dir>/<locale>/*.txt plus non-localized files at the root.
  def write_ios(cfg, dir)
    FileUtils.rm_rf(dir)
    FileUtils.mkdir_p(dir)
    ios = cfg["ios"] || {}
    put(dir, "copyright.txt", ios["copyright"])
    put(dir, "primary_category.txt", ios["primary_category"])
    put(dir, "secondary_category.txt", ios["secondary_category"])
    (cfg["review"] || {}).each { |k, v| put(File.join(dir, "review_information"), "#{k}.txt", v) if REVIEW_FIELDS.include?(k) }
    urls = cfg["urls"] || {}
    cfg["listings"].each do |locale, l|
      l ||= {}
      d = File.join(dir, locale)
      put(d, "name.txt", l["name"])
      put(d, "subtitle.txt", l["subtitle"])
      put(d, "keywords.txt", keywords(l["keywords"]))
      put(d, "promotional_text.txt", l["promotional_text"])
      put(d, "description.txt", l["description"])
      put(d, "release_notes.txt", l["release_notes"])
      IOS_LOCALIZED_URLS.each { |k| put(d, "#{k}.txt", urls[k]) }
    end
    rating = File.join(dir, "..", "age_rating.json")
    if ios["age_rating"].is_a?(Hash)
      File.write(rating, JSON.pretty_generate(ios["age_rating"]))
    else
      FileUtils.rm_f(rating)
    end
    dir
  end

  # fastlane supply layout: <dir>/<locale>/{title,short_description,full_description,video}.txt,
  # changelogs/<version_code|default>.txt, images/{icon,featureGraphic}.png, images/phoneScreenshots/…
  def write_android(cfg, dir, root:, version_code: nil)
    FileUtils.rm_rf(dir)
    FileUtils.mkdir_p(dir)
    cfg["listings"].each do |locale, l|
      l ||= {}
      a = android_listing(l)
      d = File.join(dir, locale)
      put(d, "title.txt", a["title"])
      put(d, "short_description.txt", a["short_description"])
      put(d, "full_description.txt", a["full_description"])
      put(d, "video.txt", a["video"])
      put(File.join(d, "changelogs"), "#{version_code || 'default'}.txt", l["release_notes"])

      src = File.join(root, "store/screenshots/android", locale)
      img = File.join(d, "images")
      { "phone" => "phoneScreenshots", "tablet7" => "sevenInchScreenshots", "tablet10" => "tenInchScreenshots" }.each do |from, to|
        files = Dir[File.join(src, from, "*.{png,jpg,jpeg}")].sort
        next if files.empty?
        FileUtils.mkdir_p(File.join(img, to))
        files.each { |f| FileUtils.cp(f, File.join(img, to)) }
      end
      { "icon.png" => "icon.png", "feature.png" => "featureGraphic.png" }.each do |from, to|
        f = File.join(src, from)
        next unless File.exist?(f)
        FileUtils.mkdir_p(img)
        FileUtils.cp(f, File.join(img, to))
      end
    end
    dir
  end

  # --- importers (live store → store.yml) ---------------------------------

  # Importers fill blanks and TODOs only, so text you've already written (e.g. the next
  # version's release notes) survives. Pass overwrite: true to take the live store's text wholesale.
  def import_ios(cfg, dir, overwrite: false)
    read = ->(*p) { f = File.join(dir, *p); File.exist?(f) ? File.read(f).strip : nil }
    set = ->(h, k, v) { h[k] = v if present?(v) && (overwrite || !present?(h[k]) || h[k].to_s =~ PLACEHOLDER) }
    ios = (cfg["ios"] ||= {})
    %w[copyright primary_category secondary_category].each { |k| set.(ios, k, read.("#{k}.txt")) }
    review = (cfg["review"] ||= {})
    REVIEW_FIELDS.each { |k| set.(review, k, read.("review_information", "#{k}.txt")) }
    urls = (cfg["urls"] ||= {})
    Dir[File.join(dir, "*")].select { |d| File.directory?(d) && File.basename(d) =~ /\A[a-z]{2,3}(-[A-Za-z]+)*\z/ }.sort.each do |d|
      locale = File.basename(d)
      l = (cfg["listings"][locale] ||= {})
      %w[name subtitle keywords promotional_text description release_notes].each { |k| set.(l, k, read.(locale, "#{k}.txt")) }
      IOS_LOCALIZED_URLS.each { |k| set.(urls, k, read.(locale, "#{k}.txt")) }
    end
    cfg
  end

  def import_android(cfg, dir, overwrite: false)
    files = { "title" => "title.txt", "short_description" => "short_description.txt",
              "full_description" => "full_description.txt", "video" => "video.txt" }
    Dir[File.join(dir, "*")].select { |d| File.directory?(d) }.sort.each do |d|
      locale = File.basename(d)
      l = (cfg["listings"][locale] ||= {})
      a = (l["android"] ||= {})
      files.each do |k, f|
        p = File.join(d, f)
        v = File.exist?(p) ? File.read(p).strip : nil
        a[k] = v if present?(v) && (overwrite || !present?(a[k]) || a[k].to_s =~ PLACEHOLDER)
      end
    end
    cfg
  end

  def save(cfg, path)
    header = File.exist?(path) ? File.read(path)[/\A(#[^\n]*\n)+/] : nil
    File.write(path, (header || "") + tidy(cfg).to_yaml(line_width: -1).sub(/\A---\n/, ""))
  end

  # --- helpers -----------------------------------------------------------

  # Trailing newlines make YAML fall back to ugly quoted strings; strip them before saving.
  def tidy(obj)
    case obj
    when Hash then obj.transform_values { |v| tidy(v) }
    when Array then obj.map { |v| tidy(v) }
    when String then obj.strip
    else obj
    end
  end

  # Google fields fall back to the Apple ones so most apps only write text once.
  def android_listing(l)
    a = l["android"] || {}
    {
      "title" => a["title"] || l["name"],
      "short_description" => a["short_description"] || l["subtitle"],
      "full_description" => a["full_description"] || l["description"],
      "video" => a["video"]
    }
  end

  def keywords(v)
    list = v.is_a?(Array) ? v : v.to_s.split(",")
    list.map { |k| k.to_s.strip }.reject(&:empty?).join(",")
  end

  def png_size(path)
    File.open(path, "rb") do |f|
      head = f.read(24)
      return nil unless head && head.bytesize == 24 && head[0, 8] == "\x89PNG\r\n\x1a\n".b
      head[16, 8].unpack("NN")
    end
  end

  def pngs(dir) = Dir[File.join(dir, "*.png")].sort
  def present?(v) = !v.nil? && !v.to_s.strip.empty?
  def chars(v) = v.to_s.strip.length
  def rel(p, root) = p.sub(%r{\A#{Regexp.escape(root)}/?}, "")

  def put(dir, name, value)
    return unless present?(value)
    FileUtils.mkdir_p(dir)
    File.write(File.join(dir, name), value.to_s.strip + "\n")
  end

  def walk(obj, path = nil, &blk)
    case obj
    when Hash then obj.each { |k, v| walk(v, [path, k].compact.join("."), &blk) }
    when Array then obj.each_with_index { |v, i| walk(v, "#{path}[#{i}]", &blk) }
    else blk.call(path, obj)
    end
  end
end
