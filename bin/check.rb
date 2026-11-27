#!/usr/bin/env ruby
# Same as `fastlane check`, but needs only Ruby — handy on Windows or before fastlane is installed.
#   ruby bin/check.rb [path/to/app-repo]
require_relative "../fastlane/storekit" # same file in the kit and in every app repo
root = File.expand_path(ARGV[0] || Dir.pwd)
cfg = StoreKit.load(File.join(root, "store/store.yml"))
errors, warnings = StoreKit.validate(cfg, root: root)
warnings.each { |w| puts "⚠️  #{w}" }
errors.each { |e| puts "✗ #{e}" }
if errors.empty?
  puts "✓ store.yml looks good (#{cfg['listings'].keys.join(', ')})"
else
  puts "#{errors.size} problem(s)"
  exit 1
end
