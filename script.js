const toggle = document.querySelector('.theme-toggle');
const storedTheme = localStorage.getItem('portfolio-theme');
if (storedTheme === 'dark') document.body.classList.add('dark');

toggle?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('portfolio-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

const revealItems = document.querySelectorAll('.project-card, .experience-row, .about-copy');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => {
  item.classList.add('reveal');
  observer.observe(item);
});
