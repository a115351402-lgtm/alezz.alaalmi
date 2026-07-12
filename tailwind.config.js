/** Build config for the committed tailwind.css (replaces the CDN script).
 *  Regenerate after adding new utility classes to any page:
 *    npx tailwindcss@3 -o tailwind.css --minify
 */
module.exports = {
  content: ['index.html', 'cars.html', 'car.html', 'i18n.js', 'currency.js'],
  theme: {
    extend: {
      colors: {
        sky: '#1A4DB8',           /* deep navy-blue */
        'sky-light': '#09090F',   /* near-black page bg */
        'sky-mid': '#0F1125',     /* dark section bg */
        'sky-glow': '#5B9BF5',    /* visible accent blue for text on dark */
        gold: '#C9A84C',
        'gold-light': '#F0D98A',
        'gold-dark': '#A0802A',
        ink: '#C8D8F0',           /* light text on dark bg */
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
      },
    },
  },
};
