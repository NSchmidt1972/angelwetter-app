import { createElement } from 'react';

export default function Card({
  as: component = 'div',
  className = '',
  children,
  ...props
}) {
  return createElement(component, { className, ...props }, children);
}
