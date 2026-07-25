import ClassiquePage from './classique/page';

export { generateMetadata } from './classique/page';

export default function RecettePage(props: { params: { slug: string } }) {
  return <ClassiquePage {...props} />;
}
