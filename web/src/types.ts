export type ProductStatus = 'draft' | 'published';

export interface Artisan {
  _id: string;
  name: string;
  email: string;
  location?: string;
  bio?: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  stock: number;
  status: ProductStatus;
  artisanId: Artisan;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceResponse {
  ok: boolean;
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

