# Autotune Apply buttons (0.1.6)

LuCI dom.create serializes disabled:false as disabled="false". HTML boolean
attributes remain enabled by presence, so every Apply button was disabled even
when candidate eligibility was true. Set the DOM disabled property explicitly.

Reproduced in the router browser using the real LuCI DOM factory. Verified the
corrected renderer with completed successful candidates, insufficient checks,
WARP failures and a pending operation: successful candidates were enabled;
unqualified candidates and all pending-operation buttons remained disabled.

Native saved run completed all six candidates in 605 seconds within its
15-minute budget. Two candidates each had 50/50 successful service requests,
five rounds and five WARP checks without failures. ChatGPT was not part of this
run; checkbox defaults after page reload do not describe the saved selection.
No candidate was applied by the agent during this UI correction.
