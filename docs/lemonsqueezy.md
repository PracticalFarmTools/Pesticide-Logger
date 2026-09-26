# Lemon Squeezy — checkout, not a license server

`BUY_URL` stays empty until this page exists and can take a card. The
catalog stays **Coming soon** with no Open link. Do not attach
`pesticide.practicalfarmtools.com` first.

The app verifies ECDSA keys from `tools/sign-license.js` on the device.
Lemon Squeezy takes the card. It does not generate keys this app will accept.

## Create the product

1. Sign in at [Lemon Squeezy](https://app.lemonsqueezy.com).
2. New product. Name: **Pesticide Logger**. One farm, every device they own.
3. Digital product. Suggested prices, set on Lemon Squeezy only (do not put
   them in the app): **$99 / year** and **$299 perpetual**, as two variants.
   Use one-time prices, not a Lemon Squeezy subscription. Renewal is a new
   key from the script below, not a webhook.
4. Leave **License keys** off. Those keys are not the signatures in
   `license.js`. A buyer who pastes one will be refused.
5. Publish the product. Copy the public checkout URL.

## Deliver a key

Lemon Squeezy emails you the order. On the machine that has
`keys/license-signing-key.json` (gitignored; back it up offline; it is not
in this repo):

```bash
node tools/sign-license.js --name "Jane Farmer" --email jane@example.com --expires 2027-09-21 --mail
```

Omit `--expires` for the perpetual variant. Paste the printed letter into
the reply. The public key already in `license.js` verifies it offline.

## Then, and only then

1. Set `BUY_URL` in `app-license.js` to that checkout URL. Tests reject a placeholder.
2. Deploy this repo.
3. Point `pesticide.practicalfarmtools.com` at that deployment.
4. On `practicalfarmtools.com`, switch the logger card to Active and add
   the Open link. Not before.

Setting `BUY_URL` starts the 30-day trial on devices that do not already
have a key. Empty `BUY_URL` keeps logging open and hides Buy.
