export default function Card({
  as: Component = 'div',
  className = '',
  children,
  ...props
}) {
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}
