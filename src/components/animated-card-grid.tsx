"use client";
import { Component, createRef, type ReactNode } from "react";

type Props = { children: ReactNode; revision: string; className: string };
type Positions = Map<string, DOMRect>;

/** Capture before React mutates the grid, then animate visible cards to their new positions. */
export class AnimatedCardGrid extends Component<Props, object, Positions | null> {
  private grid = createRef<HTMLUListElement>();
  private animations = new Set<Animation>();
  private preference: MediaQueryList | null = null;
  private cancel = () => {
    this.animations.forEach((animation) => animation.cancel());
    this.animations.clear();
  };
  componentDidMount() {
    this.preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.preference.addEventListener("change", this.cancel);
    window.addEventListener("resize", this.cancel);
  }
  componentWillUnmount() {
    this.cancel();
    this.preference?.removeEventListener("change", this.cancel);
    window.removeEventListener("resize", this.cancel);
  }
  getSnapshotBeforeUpdate(previous: Props): Positions | null {
    if (previous.revision === this.props.revision || this.preference?.matches) return null;
    const positions: Positions = new Map();
    this.grid.current?.querySelectorAll<HTMLElement>(":scope > li").forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) positions.set(card.dataset.cardId!, rect);
    });
    return positions;
  }
  componentDidUpdate(_previous: Props, _state: object, positions: Positions | null) {
    if (!positions) return;
    this.cancel();
    // Read final positions before animation writes to avoid repeated layout work.
    const cards = Array.from(this.grid.current?.querySelectorAll<HTMLElement>(":scope > li") ?? [])
      .map((card) => ({ card, rect: card.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight);
    cards.forEach(({ card, rect }) => {
      if (!card.animate) return;
      const before = positions.get(card.dataset.cardId!);
      const x = before ? before.left - rect.left : 0;
      const y = before ? before.top - rect.top : 8;
      if (before && Math.abs(x) < 1 && Math.abs(y) < 1) return;
      const animation = card.animate([
        { transform: `translate(${x}px, ${y}px)`, opacity: before ? 1 : 0 },
        { transform: "translate(0, 0)", opacity: 1 },
      ], { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" });
      this.animations.add(animation);
      animation.onfinish = () => this.animations.delete(animation);
    });
  }
  render() {
    return <ul ref={this.grid} className={this.props.className} onFocusCapture={this.cancel} onTouchStart={this.cancel}>{this.props.children}</ul>;
  }
}
