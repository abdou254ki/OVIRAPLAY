import React from 'react';
import { ProductClientView } from '@/components/ProductClientView';

export function generateStaticParams() {
  return [
    { slug: 'netflix-premium' },
    { slug: 'shahid-vip' },
    { slug: 'chatgpt-plus' },
    { slug: 'spotify-premium' }
  ];
}

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  return <ProductClientView slug={params.slug} />;
}
