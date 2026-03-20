import { z } from 'zod';

import { categories, experienceLevels, freelancerPlanTiers } from './contracts.js';

const brazilPhonePattern = /^\+55 \(\d{2}\) \d{4,5}-\d{4}$/;

const baseUserSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  confirmPassword: z.string(),
  phone: z
    .string()
    .trim()
    .regex(brazilPhonePattern, 'Informe um telefone válido com DDD.'),
  location: z.string().trim().min(2, 'Informe sua localização.'),
});

export const clientSignupSchema = baseUserSchema.superRefine((payload, ctx) => {
  if (payload.password !== payload.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'As senhas precisam ser iguais.',
    });
  }
});

export const freelancerSignupSchema = baseUserSchema
  .extend({
    subscriptionTier: z.enum(freelancerPlanTiers, {
      message: 'Selecione um plano.',
    }),
    hasCnpj: z
      .string()
      .trim()
      .refine((value) => value === 'Sim' || value === 'Não', {
        message: 'Informe se possui CNPJ.',
      }),
    category: z.enum(categories, { message: 'Selecione uma categoria.' }),
    profession: z.string().trim().min(2, 'Informe sua profissão.'),
    summary: z.string().trim().min(20, 'Escreva uma apresentação curta.'),
    description: z.string().trim().min(40, 'Descreva melhor seus serviços.'),
    experienceLevel: z.enum(experienceLevels, {
      message: 'Selecione um nível de experiência.',
    }),
    yearsExperience: z.coerce.number().min(0, 'Informe sua experiência em anos.'),
    averagePrice: z.coerce.number().positive('Informe um valor médio válido.'),
    avatarUrl: z.string().trim().url('Informe uma URL válida para a foto.').optional().or(z.literal('')),
    bannerUrl: z.string().trim().url('Informe uma URL válida para o banner.').optional().or(z.literal('')),
    portfolioUrl: z.string().trim().url('Informe uma URL válida para o portfólio.').optional().or(z.literal('')),
    linkedinUrl: z.string().trim().url('Informe uma URL válida para o LinkedIn.').optional().or(z.literal('')),
    websiteUrl: z.string().trim().url('Informe uma URL válida para o site.').optional().or(z.literal('')),
  })
  .superRefine((payload, ctx) => {
    if (payload.password !== payload.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'As senhas precisam ser iguais.',
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

export const searchSchema = z.object({
  search: z.string().trim().optional().default(''),
  category: z.union([z.enum(categories), z.literal('Todos')]).optional().default('Todos'),
  location: z.string().trim().optional().default(''),
  experience: z.union([z.enum(experienceLevels), z.literal('Todos')]).optional().default('Todos'),
  maxPrice: z
    .union([z.coerce.number().positive(), z.nan()])
    .optional()
    .transform((value) => (Number.isNaN(value) ? undefined : value)),
});

export const contactSchema = z.object({
  freelancerId: z.string().trim().min(1),
  freelancerName: z.string().trim().min(1),
  subject: z.string().trim().min(4),
  message: z.string().trim().min(10),
  channel: z.enum(['Plataforma', 'E-mail']),
});

export const contactReplySchema = z.object({
  message: z.string().trim().min(2, 'Escreva uma resposta mais completa.'),
});
