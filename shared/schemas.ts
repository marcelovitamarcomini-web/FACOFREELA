import { z } from 'zod';

import { categories, experienceLevels, freelancerPlanTiers } from './contracts.js';
import { isValidBrazilPhone } from './phone.js';

const brazilCepPattern = /^\d{8}$/;
const uuidSchema = z.string().trim().uuid('Identificador invalido.');

const baseUserSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo.').max(120, 'Nome muito longo.'),
  email: z.string().trim().email('Informe um e-mail válido.').max(254, 'E-mail muito longo.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.').max(128, 'Senha muito longa.'),
  confirmPassword: z.string(),
  phone: z
    .string()
    .trim()
    .refine((value) => isValidBrazilPhone(value), {
      message: 'Informe um telefone válido com DDD existente.',
    }),
  location: z.string().trim().min(2, 'Informe sua localização.').max(120, 'Localização muito longa.'),
});

export const clientSignupSchema = baseUserSchema
  .extend({
    cep: z
      .string()
      .trim()
      .regex(brazilCepPattern, 'Informe um CEP válido com 8 dígitos.'),
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

export const freelancerSignupSchema = baseUserSchema
  .extend({
    cep: z
      .string()
      .trim()
      .regex(brazilCepPattern, 'Informe um CEP válido com 8 dígitos.'),
    subscriptionTier: z.enum(freelancerPlanTiers, {
      message: 'Selecione um plano.',
    }),
    category: z.enum(categories, { message: 'Selecione uma categoria.' }),
    profession: z.string().trim().min(2, 'Informe sua profissão.').max(120, 'Profissão muito longa.'),
    summary: z.string().trim().min(20, 'Escreva uma apresentação curta.').max(280, 'Resumo muito longo.'),
    description: z.string().trim().min(40, 'Descreva melhor seus serviços.').max(4000, 'Descrição muito longa.'),
    experienceLevel: z.enum(experienceLevels, {
      message: 'Selecione um nível de experiência.',
    }),
    yearsExperience: z.coerce.number().min(0, 'Informe sua experiência em anos.').max(80, 'Experiência inválida.'),
    avatarUrl: z.string().trim().url('Informe uma URL válida para a foto.').max(500, 'URL muito longa.').optional().or(z.literal('')),
    bannerUrl: z.string().trim().url('Informe uma URL válida para o banner.').max(500, 'URL muito longa.').optional().or(z.literal('')),
    portfolioUrl: z.string().trim().url('Informe uma URL válida para o portfólio.').max(500, 'URL muito longa.').optional().or(z.literal('')),
    linkedinUrl: z.string().trim().url('Informe uma URL válida para o LinkedIn.').max(500, 'URL muito longa.').optional().or(z.literal('')),
    websiteUrl: z.string().trim().url('Informe uma URL válida para o site.').max(500, 'URL muito longa.').optional().or(z.literal('')),
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

export const emailLookupSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
});

export const signupLookupSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  phone: z
    .string()
    .trim()
    .refine((value) => isValidBrazilPhone(value), {
      message: 'Informe um telefone válido com DDD existente.',
    }),
});

export const searchSchema = z.object({
  search: z.string().trim().optional().default(''),
  category: z.union([z.enum(categories), z.literal('Todos')]).optional().default('Todos'),
  location: z.string().trim().optional().default(''),
  experience: z.union([z.enum(experienceLevels), z.literal('Todos')]).optional().default('Todos'),
});

export const contactSchema = z.object({
  freelancerId: uuidSchema,
  freelancerName: z.string().trim().min(1).max(120, 'Nome muito longo.'),
  subject: z.string().trim().min(4).max(120, 'Assunto muito longo.'),
  message: z.string().trim().min(10).max(3000, 'Mensagem muito longa.'),
});

export const contactReplySchema = z.object({
  message: z.string().trim().min(2, 'Escreva uma resposta mais completa.').max(3000, 'Mensagem muito longa.'),
});
