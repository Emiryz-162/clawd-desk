#pragma once
#include <Arduino.h>

enum Mood : uint8_t { MOOD_IDLE, MOOD_WORKING, MOOD_WAITING, MOOD_HAPPY, MOOD_SLEEP };

// Draws Clawd as pixel art. The sprite is 16 units wide and 15 units tall
// (3 units above the head are reserved for sparks, "!" and "z").
// size = width in pixels; height = size * 15 / 16. frame advances every ANIM_MS.
void clawdDraw(int x, int y, int size, Mood mood, uint32_t frame,
               uint16_t body, uint16_t eye);

inline int clawdHeight(int size) { return size * 15 / 16; }
