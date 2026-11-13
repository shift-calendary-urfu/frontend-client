let locks = 0;
let previousOverflow = "";

export function lockBodyScroll() {
  const { style } = document.body;
  if (locks === 0) {
    previousOverflow = style.overflow;
    style.overflow = "hidden";
  }
  locks++;
  return () => {
    locks--;
    if (locks === 0) style.overflow = previousOverflow;
  };
}
