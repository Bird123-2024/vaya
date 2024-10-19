import { headers } from 'next/headers';
import { Suspense } from 'react';

function Agent() {
  return <div data-agent>{headers().get('user-agent')}</div>;
}

export default function Page({ params: { slug } }) {
  return (
    <>
      <div data-page>This is the validation page: {slug}</div>
      <Suspense>
        <Agent />
      </Suspense>
    </>
  );
}
