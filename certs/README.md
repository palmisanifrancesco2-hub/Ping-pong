# Public Supabase database CA

`supabase-ca-2021.crt` is a public trust certificate, not a private key or credential.

Source verified against Supabase's official dashboard configuration:
https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

Official download:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

SHA-256 certificate fingerprint:
`807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`

Valid 28 April 2021–26 April 2031. The runner pins identity and checks validity before connecting. Node's standard CA roots remain trusted; certificate and hostname verification remain enabled. A future CA rotation requires reviewing and updating this file and pin together.
