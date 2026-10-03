type Post = { slug?: string; slag?: string; title: string; content: string };
const posts: Post[] = [
  { slug: 'hello-world', title: 'Hello World', content: 'Welcome to my blog!' },
  {
    slug: 'learning-react',
    title: 'Learning React',
    content: 'React is pretty cool.',
  },
  {
    slag: 'static-generation',
    title: 'Static Generation',
    content: 'This page was generated at build time.',
  },
];
export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}
type BlogPostProps = { params: { slug: string } };
export default function BlogPost({ params }: BlogPostProps) {
  const post = posts.find((post) => post.slug === params.slug);
  if (!post) {
    return <h1>Post not found</h1>;
  }
  return (
    <article>
      {' '}
      <h1>{post.title}</h1> <p>{post.content}</p>{' '}
    </article>
  );
}
