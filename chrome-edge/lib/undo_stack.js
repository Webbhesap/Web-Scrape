/**
 * Ö10 — generic undo/redo snapshot stack.
 * Pure data structure: the caller decides what a "state" is (e.g. a deep
 * copy of a sitemap's selector list) and how to apply it back.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UndoStack = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(limit) {
    const max = Math.max(2, limit || 50);
    const undo = []; // past states, oldest first — undoStack[last] is current
    const redo = []; // states undone, newest first

    /** Records a new state (call AFTER every mutation). Clears redo. */
    function commit(state) {
      undo.push(state);
      while (undo.length > max) undo.shift();
      redo.length = 0;
    }

    /**
     * Moves one step back. `current` is the live state right now (it becomes
     * available for redo). Returns the restored state or null at the bottom.
     */
    function stepBack(current) {
      if (undo.length < 2) return null;
      redo.push(current);
      undo.pop();
      return undo[undo.length - 1];
    }

    /** Moves one step forward. Returns the restored state or null. */
    function stepForward(current) {
      if (!redo.length) return null;
      const next = redo.pop();
      undo.push(current);
      while (undo.length > max) undo.shift();
      return next;
    }

    return {
      commit: commit,
      undo: stepBack,
      redo: stepForward,
      canUndo: () => undo.length > 1,
      canRedo: () => redo.length > 0,
      depth: () => undo.length
    };
  }

  return { create: create };
}));
