export default function Button({
  as: Component = 'button',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  if (Component === 'button') {
    return (
      <button type={type} className={className} {...props}>
        {children}
      </button>
    );
  }

  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}
