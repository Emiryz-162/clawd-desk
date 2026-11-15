#pragma once
// Face mode: the whole screen becomes Clawd's face. The case is the body,
// the screen is orange like the case, and two big pixel eyes do the rest.
#include <Arduino.h>
#include "clawd.h"

// Once per frame: picks the expression (blinks, glances, cute poses).
// happy = a job just finished; night = the room is dark.
void faceUpdate(Mood mood, bool happy, bool night, uint32_t now);
// Draws the current expression over the whole screen (called per strip).
void faceDraw();
