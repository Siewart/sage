try {
  var sageTheme = localStorage.getItem("sage-theme");
  if (sageTheme === "light" || sageTheme === "dark")
    document.documentElement.dataset.theme = sageTheme;
} catch {
  // System colors still work when browser storage is unavailable.
}
