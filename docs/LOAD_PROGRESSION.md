# How the next session changes

After a workout the person taps 1–5. 1 is too easy, 3 is right, 5 is too hard or unfinished. Pain is a separate switch. One tap on a number saves the session. A note and per-exercise marks are optional.

Ratings are stored on the existing local profile (`loadProgress`). Old logs stay. Missing fields mean “no rating yet”.

## The rule

Each exercise sits on a ladder of small doses. A pull-up chain is one ladder: dead hang 15→30 s, scapular pull-up 8→12, negative 2→3, band-assisted 5→8, chin-up 3→5, pull-up 3→8. Other exercises step by 2 reps or 5 seconds. A kettlebell exercise may gain one set only after reps are already at the top. Walking steps by one minute, from −3 to +5 around the planned block.

One finished session moves the index by at most 1.

| Latest mark | What happens |
|---|---|
| Pain, any number | One step easier. The app says to rest and see a doctor if the pain continues. |
| 5 | One step easier. |
| 4 | One step easier (the “slightly lighter” step). |
| 3 | Stay. |
| 1 or 2, and the one before was also ≤2 and not painful | One step harder. |
| 1 or 2, first time or after a harder mark | Stay. The hint says the next easy one will add a step. |

The index never moves past either end. Two easy ratings are required before anything gets harder, so a single light day does not stack.

## Beginner cap

Nothing in this module changes the kettlebell from 16 kg to 24 kg. Reps stop at the programmed number plus 8, and at 16 if the exercise uses a 16 kg bell. Sets stop at the programmed count plus 1, and never above 4. Holds stop at 90 seconds. The pull-up chain stops at 8 strict pull-ups.

## Where it shows

The Today list shows the dose and ↑, =, or ↓ against the last decision, with the short reason. Progress lists the same ladders and the recent 1–5 marks.
