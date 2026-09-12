import { Link } from 'react-router';

export default function Home({ data }: { data: { title: string } }) {
  return (
    <>
      <Link to="/contact">Contact</Link>
      <h1>This: {data.title}</h1>
    </>
  );
}
