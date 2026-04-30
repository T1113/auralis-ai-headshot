async function initI18n() {
    const response = await fetch('./assets/js/locales.json');
    const locales = await response.json();
    
    const savedLang = localStorage.getItem('selectedLang') || 'zh';
    setLanguage(savedLang, locales);

    document.querySelectorAll('.lang-selector').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.getAttribute('data-lang');
            setLanguage(lang, locales);
            localStorage.setItem('selectedLang', lang);
        });
    });
}

function setLanguage(lang, locales) {
    const translations = locales[lang];
    if (!translations) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });

    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
}

document.addEventListener('DOMContentLoaded', initI18n);
