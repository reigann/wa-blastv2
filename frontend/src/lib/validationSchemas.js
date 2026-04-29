import { zodResolver } from '@hookform/resolvers/zod';
import { useForm as useFormReactHookForm } from 'react-hook-form';
import { z } from 'zod';

/**
 * Custom useForm hook that integrates react-hook-form with zod validation
 */
export function useForm(schema, options = {}) {
  return useFormReactHookForm({
    resolver: zodResolver(schema),
    ...options,
  });
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  email: z.string().email('Email tidak valid'),
  phone: z.string().regex(/^(\+62|0)[0-9]{9,12}$/, 'Nomor telepon tidak valid'),
  name: z.string().min(3, 'Nama minimal 3 karakter').max(100, 'Nama maksimal 100 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  message: z.string().min(1, 'Pesan tidak boleh kosong').max(1000, 'Pesan maksimal 1000 karakter'),
  url: z.string().url('URL tidak valid'),
  number: z.number().positive('Harus bilangan positif'),
};

/**
 * Contact form schema
 */
export const contactFormSchema = z.object({
  name: validationSchemas.name,
  phone: validationSchemas.phone,
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  group: z.string().min(1, 'Pilih grup'),
});

/**
 * Blast form schema
 */
export const blastFormSchema = z.object({
  templateId: z.string().min(1, 'Pilih template'),
  recipientGroup: z.string().min(1, 'Pilih grup penerima'),
  recipientList: z.string().optional(),
  message: validationSchemas.message,
  delay: z.number().min(0, 'Delay tidak boleh negatif').max(60000, 'Delay maksimal 60 detik'),
  isDraft: z.boolean().optional(),
});

/**
 * Template form schema
 */
export const templateFormSchema = z.object({
  name: validationSchemas.name,
  content: z.string().min(5, 'Content minimal 5 karakter'),
  category: z.string().min(1, 'Pilih kategori'),
  variables: z.array(z.string()).optional(),
});

/**
 * Clustering form schema
 */
export const clusteringFormSchema = z.object({
  nClusters: z.number().min(2, 'Minimal 2 cluster').max(10, 'Maksimal 10 cluster'),
  method: z.enum(['kmeans', 'hierarchical']),
});
