import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export default function Contact({ data }: { data: { title: string } }) {
  const { i18n, t } = useTranslation('contact');
  return (
    <main className="m-auto flex flex-col text-center">
      <section>
        <button
          onClick={() => {
            i18n.changeLanguage('fr');
          }}
        >
          FR
        </button>
        <button
          onClick={() => {
            i18n.changeLanguage('en');
          }}
        >
          EN
        </button>
      </section>
      <section>
        <Link to="/">Home</Link>
        <h1>{t('contact')}</h1>
        <p>{data.title}</p>
      </section>
    </main>
  );
}
