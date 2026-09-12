import './index.css';
import Router from './components/Router.js';
import type { RouteData } from './types';

export default function App({ props }: { props?: RouteData }) {
  return <Router props={props} />;
}
