import { Link } from 'react-router';
import { useServerProps } from '../router/ServerPropsProvider.js';

export default function Home() {
  const props = useServerProps<{ title: string }>();
  return (
    <>
      <Link to="/contact">Contact doesn't exist</Link>
      <h1>Title: {props?.title}</h1>
    </>
  );
}
