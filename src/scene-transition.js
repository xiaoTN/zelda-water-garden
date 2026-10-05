(function (root) {
  'use strict';
  function Transition(current, reduced) {
    this.current = current; this.target = current; this.phase = 'idle'; this.opacity = 0;
    this.cover = reduced ? .10 : .28; this.reveal = reduced ? .16 : .56;
    this.elapsed = 0; this.start = 0; this.duration = 0;
  }
  Transition.prototype.begin = function (phase) {
    this.phase = phase; this.elapsed = 0; this.start = this.opacity;
    this.duration = Math.max(.04, (phase === 'cover' ? this.cover * (1 - this.opacity) : this.reveal * this.opacity));
  };
  Transition.prototype.request = function (kind) {
    if (kind !== 'water' && kind !== 'snow' && kind !== 'cloud') return false;
    if (kind === this.target) return false;
    this.target = kind;
    // Retarget from the visible opacity; never reset the veil or flash a skipped scene.
    if (kind === this.current) this.begin('reveal');
    else if (this.phase !== 'cover') this.begin('cover');
    return true;
  };
  Transition.prototype.update = function (dt) {
    if (this.phase === 'idle') return null;
    this.elapsed += Math.max(0, dt);
    var t = Math.min(1, (this.elapsed + 1e-9) / this.duration), ease = t * t * (3 - 2 * t);
    this.opacity = this.start + ((this.phase === 'cover' ? 1 : 0) - this.start) * ease;
    if (t < 1) return null;
    if (this.phase === 'cover') {
      this.current = this.target; this.begin('reveal');
      return this.current;
    }
    this.phase = 'idle'; this.opacity = 0;
    return null;
  };
  Transition.prototype.finish = function () {
    var changed = this.current !== this.target;
    this.current = this.target; this.phase = 'idle'; this.opacity = 0;
    return changed ? this.current : null;
  };
  Transition.prototype.inspect = function () {
    return { current: this.current, target: this.target, phase: this.phase, opacity: this.opacity };
  };
  root.SceneTransition = Transition;
  if (typeof module !== 'undefined' && module.exports) module.exports = Transition;
}(typeof window !== 'undefined' ? window : global));
