/** The first focusable element on every page: jumps past the header to `<main id="main">`. */
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  );
}
