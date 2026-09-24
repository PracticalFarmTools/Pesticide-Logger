# South Dakota private-applicator records — question for DANR

South Dakota is `privateDuty: uncertain` (`laws/SD.json`). No sentence in
the statute or the rules names private applicators, so the app will not
promote SD on inference. A written answer from the agency settles it.
Send the letter below to the DANR Pesticide Program (contact on
danr.sd.gov). Keep the reply with the farm papers.

When the answer arrives:

- **Yes, 12:56:07:01 covers certified private applicators** → quote the
  reply (date, sender, program) in `laws/SD.json` `notes`, set
  `"privateDuty": "required"`, then `node tools/bundle-state-laws.js --stamp SD`,
  bundle, and run the tests in one commit.
- **No** → quote it, set `"privateDuty": "none"`, same steps.
- **No answer / "follow the label"** → leave `uncertain`.

---

Subject: Does ARSD 12:56:07:01 apply to certified private applicators?

Hello,

I build a spray-record app for South Dakota growers and want its record
list to match your rules exactly.

ARSD 12:56:07:01 says “Each applicator shall keep records…” and
12:56:07:03 says the records are kept three years. SDCL 38-21-24 lets the
secretary require records of “private and commercial applicators.” I could
not find a definition of the bare word “applicator” in SDCL 38-21-14 or
ARSD 12:56:01:01, and 12:56:07:04 says “Commercial applicator” where
12:56:07:01 does not.

Does 12:56:07:01 require a certified private applicator (SDCL 38-21-14(20))
to keep records of each pesticide application on their own or rented land?
If so, is that all pesticides, or only restricted-use pesticides?

A one-line answer is enough. Thank you.

[Name]
Practical Farm Tools · practicalfarmtools@gmail.com
