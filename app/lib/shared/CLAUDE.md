# shared — Rules

Only genuinely shared, presentational widgets (props-in, no data-fetching),
e.g. `OfflineBanner`. Same rule as the dashboard's `components/`: a widget lives
in a feature's `presentation/` until a second feature needs it, then it moves here.
