import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Freelancer } from '../../shared/contracts';
import { FreelancerVerifiedSeal } from '../components/FreelancerVerifiedSeal';
import { ImageCropDialog } from '../components/ImageCropDialog';
import { SectionHeading } from '../components/SectionHeading';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { buildWhatsappUrl } from '../lib/external-contact';
import { shortDate } from '../lib/format';
import { acceptedImageTypes, profileAssetGuidelines, readImageDimensions } from '../lib/profile-assets';

function CameraButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/92 text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
        viewBox="0 0 24 24"
      >
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.8A1.5 1.5 0 0 1 10.46 3.5h3.08a1.5 1.5 0 0 1 1.25.7L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
        <circle cx="12" cy="12.5" r="3.5" />
      </svg>
    </button>
  );
}

function buildFreelancerIntro(name: string) {
  const firstName = name.trim().split(' ')[0] ?? 'você';
  return `Olá, encontrei seu perfil no Faço Freela e quero falar sobre um serviço com ${firstName}.`;
}

export function FreelancerProfilePage() {
  const { slug } = useParams();
  const { session } = useAppSession();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [uploadingKind, setUploadingKind] = useState<'avatar' | 'banner' | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{
    file: File;
    kind: 'avatar' | 'banner';
  } | null>(null);

  useEffect(() => {
    if (typeof slug !== 'string') {
      return;
    }

    const controller = new AbortController();
    const currentSlug = slug;

    async function loadFreelancer() {
      try {
        const data = await api.getFreelancer(currentSlug, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setFreelancer(data);
          setError(null);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível carregar o perfil.',
          );
        }
      }
    }

    void loadFreelancer();

    return () => controller.abort();
  }, [slug]);

  async function validateProfileAssetFile(kind: 'avatar' | 'banner', file: File) {
    const guideline = profileAssetGuidelines[kind];
    const dimensions = await readImageDimensions(file);

    if (
      dimensions.width < guideline.minimumWidth ||
      dimensions.height < guideline.minimumHeight
    ) {
      throw new Error(
        kind === 'avatar'
          ? `A foto precisa ter pelo menos ${guideline.minimumWidth} x ${guideline.minimumHeight} px. O ideal é ${guideline.recommendedSize}.`
          : `O banner precisa ter pelo menos ${guideline.minimumWidth} x ${guideline.minimumHeight} px. O ideal é ${guideline.recommendedSize}.`,
      );
    }

    if (kind === 'banner' && dimensions.width / dimensions.height < 2.2) {
      throw new Error('Use um banner horizontal. O ideal é 1500 x 500 px.');
    }
  }

  async function handleMediaUpload(kind: 'avatar' | 'banner', file?: File) {
    if (!file) {
      return;
    }

    setUploadingKind(kind);
    setMediaStatus(null);

    try {
      const response = await api.uploadProfileAsset(kind, file);

      setFreelancer((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          avatarUrl: kind === 'avatar' ? response.publicUrl : current.avatarUrl,
          bannerUrl: kind === 'banner' ? response.publicUrl : current.bannerUrl,
        };
      });

      setMediaStatus({
        tone: 'success',
        text:
          kind === 'avatar'
            ? 'Foto de perfil atualizada com sucesso.'
            : 'Banner do perfil atualizado com sucesso.',
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : 'Não foi possível concluir o upload da imagem.';
      setMediaStatus({
        tone: 'error',
        text: message,
      });
      throw new Error(message);
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleMediaSelection(
    kind: 'avatar' | 'banner',
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setMediaStatus(null);

    try {
      await validateProfileAssetFile(kind, file);
      setPendingCrop({
        file,
        kind,
      });
    } catch (selectionError) {
      setMediaStatus({
        tone: 'error',
        text:
          selectionError instanceof Error
            ? selectionError.message
            : 'Não foi possível preparar a imagem para edição.',
      });
    }
  }

  async function handleCropSave(file: File) {
    if (!pendingCrop) {
      return;
    }

    await handleMediaUpload(pendingCrop.kind, file);
    setPendingCrop(null);
  }

  if (error) {
    return (
      <div className="container py-10 sm:py-12 lg:py-14">
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!freelancer) {
    return (
      <div className="container py-10 sm:py-12 lg:py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Carregando perfil profissional...
        </div>
      </div>
    );
  }

  const isOwner = session?.role === 'freelancer' && session.id === freelancer.id;
  const hasVerificationSeal = freelancer.subscriptionTier === 'booster';
  const firstName = freelancer.name.split(' ')[0];
  const whatsappUrl = buildWhatsappUrl(freelancer.whatsapp, buildFreelancerIntro(freelancer.name));
  const externalChannels = [
    whatsappUrl
      ? {
          href: whatsappUrl,
          label: 'Abrir WhatsApp',
          helper: 'Contato rápido e direto.',
          tone: 'primary' as const,
        }
      : null,
    freelancer.websiteUrl
      ? {
          href: freelancer.websiteUrl,
          label: 'Visitar site',
          helper: 'Portfólio, proposta ou página profissional.',
          tone: 'secondary' as const,
        }
      : null,
    freelancer.linkedinUrl
      ? {
          href: freelancer.linkedinUrl,
          label: 'Ver LinkedIn',
          helper: 'Perfil profissional e experiência.',
          tone: 'secondary' as const,
        }
      : null,
  ].filter(
    (
      channel,
    ): channel is {
      href: string;
      label: string;
      helper: string;
      tone: 'primary' | 'secondary';
    } => Boolean(channel),
  );
  const trustPoints = [
    {
      title: 'Portfólio visível',
      description: 'Veja trabalhos e referências antes de entrar em contato.',
    },
    {
      title: 'Contato externo pronto',
      description: 'O perfil já aponta para WhatsApp, site ou outros canais quando fizer sentido.',
    },
    {
      title: 'Menos peso no sistema',
      description: 'O primeiro contato sai do site sem perder o contexto do perfil.',
    },
  ];
  const bannerStyle = freelancer.bannerUrl
    ? {
        backgroundImage: `url(${freelancer.bannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div className="container py-10 sm:py-12 lg:py-14">
      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div
          className="relative z-0 aspect-[16/7] overflow-hidden bg-slate-100 sm:aspect-[3/1]"
          style={bannerStyle}
        >
          {isOwner ? (
            <div className="absolute right-4 top-4 z-20">
              <CameraButton
                disabled={uploadingKind !== null}
                label={uploadingKind === 'banner' ? 'Enviando banner...' : 'Alterar banner'}
                onClick={() => bannerInputRef.current?.click()}
              />
            </div>
          ) : null}
        </div>

        <div className="relative z-10 grid gap-8 px-4 pb-8 pt-4 sm:px-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-10">
          <div className="mt-0 space-y-6 sm:-mt-12">
            <div className="relative z-20 rounded-[30px] border border-white/80 bg-white/96 p-4 shadow-[0_18px_46px_rgba(15,23,42,0.08)] sm:px-5 sm:py-4 xl:max-w-[860px]">
              <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start">
                <div className="relative z-20 w-fit self-start rounded-[26px] bg-white p-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                  <img
                    alt={freelancer.name}
                    className="h-20 w-20 shrink-0 rounded-[22px] object-cover object-center sm:h-24 sm:w-24"
                    src={freelancer.avatarUrl}
                  />
                  {isOwner ? (
                    <div className="absolute -bottom-2 -right-2">
                      <CameraButton
                        disabled={uploadingKind !== null}
                        label={uploadingKind === 'avatar' ? 'Enviando foto...' : 'Alterar foto'}
                        onClick={() => avatarInputRef.current?.click()}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1 sm:pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="break-words text-[1.8rem] font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-[3rem] xl:text-[4rem]">
                      {freelancer.name}
                    </h1>
                    {hasVerificationSeal ? <FreelancerVerifiedSeal /> : null}
                  </div>
                  <p className="text-base font-medium leading-tight text-slate-600 sm:text-lg">
                    {freelancer.profession}
                  </p>
                  <p className="text-sm leading-snug text-slate-500">
                    {freelancer.location} • membro desde {shortDate(freelancer.memberSince)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="max-w-3xl text-base leading-7 text-slate-600">{freelancer.summary}</p>
            </div>

            {isOwner && mediaStatus ? (
              <div
                className={`rounded-[24px] px-4 py-3 text-sm ${
                  mediaStatus.tone === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {mediaStatus.text}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {trustPoints.map((point) => (
                <div
                  key={point.title}
                  className="rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-sm font-semibold text-slate-800">{point.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{point.description}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Categoria</p>
                <p className="mt-2 text-base font-semibold text-slate-700">{freelancer.category}</p>
              </div>
              <div className="hidden rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Tempo de atuacao</p>
                <p className="mt-2 text-base font-semibold text-slate-700">
                  {freelancer.yearsExperience} anos
                </p>
              </div>
              <div className="hidden rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Experiência</p>
                <p className="mt-2 text-base font-semibold text-slate-700">
                  {freelancer.experienceLevel} • {freelancer.yearsExperience} anos
                </p>
              </div>
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Disponibilidade</p>
                <p className="mt-2 text-base font-semibold text-slate-700">
                  {freelancer.availability}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeading
                description="Veja o posicionamento do profissional, como ele se apresenta e os trabalhos que já publicou."
                eyebrow="Sobre o profissional"
                title="Perfil pensado para transmitir confiança"
              />
              <p className="text-base leading-8 text-slate-600">{freelancer.description}</p>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Habilidades
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {freelancer.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[#0071e3]/16 bg-[#0071e3]/7 px-4 py-2 text-sm font-semibold text-[#0059b3]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Portfólio
              </p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {freelancer.portfolio.map((item) => (
                  <a
                    key={`${item.title}-${item.url}`}
                    className="glass-panel rounded-[28px] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-1"
                    href={item.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Link externo
                    </p>
                    <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                    <span className="mt-5 inline-flex text-sm font-semibold text-[#0071e3]">
                      Acessar trabalho
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <aside className="self-start rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,249,255,0.96)_100%)] p-6 text-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.06)] lg:mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
              Contato externo
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
              Fale com {firstName} do jeito mais direto
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Para aliviar a plataforma neste começo, o primeiro contato acontece fora do site. Use
              os atalhos públicos deste perfil quando eles estiverem disponíveis.
            </p>

            {isOwner ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">Este é o seu perfil público</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Tudo o que os clientes enxergam fica aqui. Use esta página para revisar sua
                    apresentação, revisar os canais externos e atualizar foto ou capa direto na
                    imagem.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">Padrão de imagem</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <p>Foto de perfil: ideal em 800 x 800 px e máximo de 5 MB.</p>
                    <p>Banner do perfil: ideal em 1500 x 500 px e máximo de 8 MB.</p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Use imagens nítidas e com boa luz. O banner funciona melhor no formato
                    horizontal.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">Canais visíveis no perfil</p>
                  {externalChannels.length > 0 ? (
                    <div className="mt-4 grid gap-3">
                      {externalChannels.map((channel) => (
                        <a
                          key={channel.label}
                          className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-[#0071e3]/25 hover:bg-white"
                          href={channel.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <p className="text-sm font-semibold text-slate-950">{channel.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{channel.helper}</p>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Seu perfil ainda não mostra WhatsApp, site ou LinkedIn. O WhatsApp costuma
                      sair do celular cadastrado.
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0077ed]"
                    to="/dashboard/freelancer"
                  >
                    Abrir dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Escolha o melhor canal para avançar
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    O perfil já concentra as informações principais para você decidir se prefere
                    chamar no WhatsApp, visitar o site ou validar a experiência no LinkedIn.
                  </p>
                </div>

                {externalChannels.length > 0 ? (
                  <div className="grid gap-3">
                    {externalChannels.map((channel) => (
                      <a
                        key={channel.label}
                        className={`rounded-[24px] border px-5 py-4 text-left transition ${
                          channel.tone === 'primary'
                            ? 'border-[#0071e3]/20 bg-[#0071e3]/6 hover:bg-[#0071e3]/10'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        href={channel.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <p className="text-sm font-semibold text-slate-950">{channel.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{channel.helper}</p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                    Este profissional ainda não publicou um atalho externo de contato. Você pode
                    avaliar o portfólio e voltar depois.
                  </div>
                )}

                {session?.role !== 'client' ? (
                  <div className="grid gap-3">
                    <Link
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0077ed]"
                      to="/cadastro/cliente"
                    >
                      Criar conta de cliente
                    </Link>
                    <Link
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      to="/login"
                    >
                      Entrar
                    </Link>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Por que esse fluxo ajuda</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isOwner
                  ? 'Seu perfil já apresenta o serviço e abre a porta para canais externos sem depender de uma central interna.'
                  : 'Você conhece o profissional primeiro e escolhe o canal externo só quando decidir seguir, deixando a navegação mais leve.'}
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Disponibilidade atual</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{freelancer.availability}</p>
            </div>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Regra de comunicação</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Neste momento, o Faço Freela prioriza contato externo no primeiro passo para manter
                a operação mais leve e o perfil mais objetivo.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {isOwner ? (
        <>
          <input
            accept={acceptedImageTypes}
            className="hidden"
            onChange={(event) => void handleMediaSelection('avatar', event)}
            ref={avatarInputRef}
            type="file"
          />
          <input
            accept={acceptedImageTypes}
            className="hidden"
            onChange={(event) => void handleMediaSelection('banner', event)}
            ref={bannerInputRef}
            type="file"
          />
        </>
      ) : null}

      {pendingCrop ? (
        <ImageCropDialog
          file={pendingCrop.file}
          kind={pendingCrop.kind}
          onCancel={() => setPendingCrop(null)}
          onConfirm={handleCropSave}
        />
      ) : null}
    </div>
  );
}
