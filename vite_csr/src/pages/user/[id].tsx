import { useParams } from 'react-router';

export default function UserProfile() {
  const { id } = useParams();
  return <h1>User ID: {id}</h1>;
}
