function goToMain() {
  if (window.pywebview) {
    window.pywebview.api.load_view("main");
  }
}


// Attach click event to all links inside creator-buttons div
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.creator-buttons a').forEach(link => {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      const href = this.getAttribute('href');
      if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.open_external(href);
      } else {
        window.open(href);
      }
    });
  });
});
