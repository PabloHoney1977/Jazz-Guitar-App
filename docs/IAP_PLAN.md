# IAP Implementation Plan — Pro unlock ($9.99 one-time)

This is the **revenue gate**. Until it's done there is no income and Apple will
reject the build (a priced paywall that unlocks without StoreKit is a rejection).

> **Status (code wired):** The app-side IAP logic is now implemented in `app.js`
> — an `IAP` module (RevenueCat Capacitor plugin, guarded by `isNativeApp()`),
> real `doUpgrade()`/`doRestore()`, and an entitlement-on-launch sync. **The
> web/PWA path is unchanged**: beta testers still get the free Pro preview and
> can never be charged (no StoreKit in a browser). Remaining work is all
> environment/account setup, not code: (1) `npm i @revenuecat/purchases-capacitor`
> + `npx cap sync ios`, (2) set `REVENUECAT_API_KEY` and the `pro` entitlement /
> `pro_unlock` product in RevenueCat + App Store Connect, (3) sandbox-test on a
> device (needs the $99 Apple enrollment first). Until the plugin is installed,
> native purchase returns `'no-store'` and grants nothing — it never hands out
> free Pro on device.

## Current state (what exists today)

The whole Pro/Free split already runs off **one** piece of state:

- `level` ∈ `'essentials' | 'pro'`, held in `App` (`app.js`), persisted to
  `localStorage['jg-level']`, read in ~20 places via `level==='essentials'`.
- Two stub functions are the *only* integration points:

```js
function doUpgrade(){            // app.js ~line 4476
  // TODO: StoreKit/RevenueCat purchase
  setLevel('pro'); safeLSSet('jg-level','pro');     // ← grants Pro for FREE
  setUpgradeSheet(null);
}
function doRestore(){            // app.js ~line 4481
  // TODO: RevenueCat restorePurchases()
  setLevel('pro'); safeLSSet('jg-level','pro');     // ← grants Pro for FREE
}
```

Because the entire gating funnels through `level`, **wiring real IAP touches
almost no other code** — that's the payoff of the current design. You replace
what *sets* `level`, not the 20 places that *read* it.

## Recommendation: RevenueCat (not raw StoreKit)

For a solo dev shipping one non-consumable, RevenueCat is the pragmatic choice:

- Official Capacitor plugin: `@revenuecat/purchases-capacitor`.
- Handles receipt validation, the restore flow, and "is this user Pro?" as a
  server-verified **entitlement** — so Pro survives reinstall and can't be
  faked by editing localStorage.
- Free up to $2.5k/mo tracked revenue — effectively free at your stage.
- One dashboard instead of hand-rolling StoreKit + receipt validation.

Raw StoreKit via `@capacitor-community/in-app-purchases` is viable but you'd own
receipt validation and restore correctness yourself. Not worth it for one product.

## The one design change that matters: entitlement is the source of truth

Today `level` trusts localStorage. With real money that's wrong — it means
"free Pro by clearing/setting a key," and it doesn't survive a reinstall. New rule:

- **On launch**, ask RevenueCat for the customer's entitlements and set `level`
  from that. Treat `localStorage['jg-level']` as a cache for offline only.
- A purchase or restore updates the entitlement → which updates `level`.

## Concrete wiring

### 1. Plugin + init (app bootstrap, native only)
```js
// Capacitor bridge is absent in the browser PWA — guard everything.
const RC = window?.Capacitor?.Plugins?.Purchases || null;
const RC_API_KEY = 'appl_XXXXXXXX';     // RevenueCat → Apple API key
const ENTITLEMENT = 'pro';              // entitlement id in RevenueCat
const PRODUCT_ID  = 'pro_unlock';       // matches App Store Connect + CLAUDE.md

async function rcConfigure(){
  if(!RC) return;
  await RC.configure({ apiKey: RC_API_KEY });
}
async function rcIsPro(){
  if(!RC) return safeLS('jg-level','essentials')==='pro'; // offline cache
  try{
    const { customerInfo } = await RC.getCustomerInfo();
    return !!customerInfo?.entitlements?.active?.[ENTITLEMENT];
  }catch(e){ return safeLS('jg-level','essentials')==='pro'; }
}
```

### 2. Replace the stubs
```js
async function doUpgrade(){
  if(!RC){ /* browser/PWA: keep dev behavior or show "iOS only" */ return; }
  try{
    const { offerings } = await RC.getOfferings();
    const pkg = offerings?.current?.availablePackages
      ?.find(p => p.product.identifier === PRODUCT_ID)
      || offerings?.current?.availablePackages?.[0];
    if(!pkg) return;
    const { customerInfo } = await RC.purchasePackage({ aPackage: pkg });
    if(customerInfo?.entitlements?.active?.[ENTITLEMENT]){
      setLevel('pro'); safeLSSet('jg-level','pro'); setUpgradeSheet(null);
    }
  }catch(e){
    // e.userCancelled === true on user cancel — just close, no error UI
  }
}

async function doRestore(){
  if(!RC) return;
  try{
    const { customerInfo } = await RC.restorePurchases();
    const pro = !!customerInfo?.entitlements?.active?.[ENTITLEMENT];
    setLevel(pro ? 'pro' : 'essentials');
    safeLSSet('jg-level', pro ? 'pro' : 'essentials');
    return pro; // AboutSheet already shows "Purchase restored ✓" on success
  }catch(e){ return false; }
}
```

### 3. Launch sync
```js
useEffect(()=>{ (async()=>{
  await rcConfigure();
  if(await rcIsPro()){ setLevel('pro'); safeLSSet('jg-level','pro'); }
})(); },[]);
```

### 4. Remove dev unlock affordances for production
- The "Pro ✦" header chip reverts to Essentials on tap (`app.js` ~line 4738) —
  fine for testing, **must not ship** as a user-facing free downgrade/toggle.
- `GuitarToggle` (`app.js` ~line 570) flips level directly — keep out of prod UI.
- Keep `openPreset`'s `p.level` path (Guide presets) — that only ever sets Pro
  for gated previews and is harmless, but double-check no preset grants Pro
  permanently. (It sets `level` state; with entitlement-on-launch as source of
  truth, a relaunch corrects it.)

## Apple-side setup (App Store Connect)
1. Create a **Non-Consumable** IAP, product id `pro_unlock`, price $9.99.
2. Add localized display name + description; attach a review screenshot.
3. Create a **Sandbox tester** account for testing purchases.
4. In RevenueCat: add the app, paste the App Store Connect API key, create the
   `pro` entitlement, attach product `pro_unlock`, put it in the default Offering.

## Test checklist (sandbox, on device)
- [ ] Fresh install → Essentials. Buy → becomes Pro. Force-quit + relaunch → still Pro.
- [ ] Delete app → reinstall → tap **Restore** → Pro returns (no second charge).
- [ ] Cancel mid-purchase → stays Essentials, no error popup.
- [ ] Airplane mode → app still usable; cached level respected; no crash.
- [ ] Editing/clearing `jg-level` cannot grant Pro after a relaunch (entitlement wins).

## Effort estimate
~0.5–1 day of coding (the gating already exists) + Apple/RevenueCat dashboard
setup + sandbox testing. The long pole is **Apple Developer enrollment** ($99,
1–2 days to process) and App Store Connect product approval, not the code.
