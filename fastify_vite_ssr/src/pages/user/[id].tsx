import { useParams } from 'react-router';

export default function UserProfile({ data }: { data: { id: string } }) {
  const { id } = useParams();
  return (
    <h1>
      User ID: {id} - Data: {JSON.stringify(data)}
    </h1>
  );
}
