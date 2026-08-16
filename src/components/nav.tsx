import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link } from '@tanstack/react-router';

/**
 * Typed links to the parameterised content routes.
 *
 * Mantine's polymorphic `component={Link}` erases TanStack Router's route generics, so a
 * `params` object passed that way is untyped — a renamed route param would compile
 * happily and 404 at runtime. These wrappers take the params as their own props, keeping
 * the route typed while still letting Mantine style the anchor.
 */

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export const ContentTypeLink = forwardRef<HTMLAnchorElement, AnchorProps & { typePath: string }>(
  function ContentTypeLink({ typePath, ...props }, ref) {
    return <Link ref={ref} to="/content/$typePath" params={{ typePath }} {...props} />;
  },
);

export const ContentItemLink = forwardRef<
  HTMLAnchorElement,
  AnchorProps & { typePath: string; entityKey: string }
>(function ContentItemLink({ typePath, entityKey, ...props }, ref) {
  return (
    <Link
      ref={ref}
      to="/content/$typePath/$key"
      params={{ typePath, key: entityKey }}
      search={{}}
      {...props}
    />
  );
});
