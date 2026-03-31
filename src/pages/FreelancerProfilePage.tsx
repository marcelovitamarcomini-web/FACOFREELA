import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import type { Freelancer } from '../../shared/contracts';
import { FreelancerVerifiedSeal } from '../components/FreelancerVerifiedSeal';
import { ImageCropDialog } from '../components/ImageCropDialog';
import { contactSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { SectionHeading } from '../components/SectionHeading';
import { useChat } from '../context/ChatContext';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { handleDesktopEnterSubmit } from '../lib/desktop-submit';
import { shortDate } from '../lib/format';
import { acceptedImageTypes, profileAssetGuidelines, readImageDimensions } from '../lib/profile-assets';
import { getFieldErrors } from '../lib/validation';

type ContactFormState = {
  subject: string;
  message: string;
};

const initialContactForm: ContactFormState = {
  subject: '',
  message: '',
};

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

export function FreelancerProfilePage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh } = useChat();
  const { session } = useAppSession();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormState>(initialContactForm);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [contactStatus, setContactStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [submittingContact, setSubmittingContact] = useState(false);
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

  function handleContactChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setContactForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!freelancer) {
      return;
    }

    setContactStatus(null);

    const parsed = contactSchema.safeParse({
      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
      ...contactForm,
    });

    if (!parsed.success) {
      setContactErrors(getFieldErrors(parsed.error));
      return;
    }

    setContactErrors({});
    setSubmittingContact(true);

    try {
      const createdContact = await api.createContact(parsed.data);
      setContactForm(initialContactForm);
      setContactStatus({
        tone: 'success',
        text: 'Conversa atualizada. O histórico segue na central de mensagens.',
      });
      await refresh();
      navigate(`/mensagens?chat=${createdContact.id}`);
    } catch (submitError) {
      setContactStatus({
        tone: 'error',
        text:
          submitError instanceof Error
            ? submitError.message
            : 'Não foi possível enviar sua mensagem agora.',
      });
    } finally {
      setSubmittingContact(false);
    }
  }

  function handleContactMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    handleDesktopEnterSubmit(event);
  }

  async function validateProfileAssetFile(kind: 'avatar' | 'banner', file: File) {
    const guideline = profileAssetGuidelines[kind];
    const dimensions = await readImageDimensions(file);

    if (
      dimensions.width < guideline.minimumWidth ||
      dimensions.height < guideline.minimumHeight
    ) {
      throw new Error(
        kind === 'avatar'
          ? `A foto precisa ter pelo menos ${guideline.minimumWidth} x ${guideline.minimumHeight} px. O ideal e ${guideline.recommendedSize}.`
          : `O banner precisa ter pelo menos ${guideline.minimumWidth} x ${guideline.minimumHeight} px. O ideal e ${guideline.recommendedSize}.`,
      );
    }

    if (kind === 'banner' && dimensions.width / dimensions.height < 2.2) {
      throw new Error('Use um banner horizontal. O ideal e 1500 x 500 px.');
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
          : 'N?o foi poss?vel concluir o upload da imagem.';
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
            : 'N?o foi poss?vel preparar a imagem para edi??o.',
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
      <div className="container py-14">
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!freelancer) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Carregando perfil profissional...
        </div>
      </div>
    );
  }

  const isClient = session?.role === 'client';
  const isOwner = session?.role === 'freelancer' && session.id === freelancer.id;
  const hasVerificationSeal = freelancer.subscriptionTier === 'booster';
  const firstName = freelancer.name.split(' ')[0];
  const trustPoints = [
    {
      title: 'Portfólio visível',
      description: 'Veja trabalhos e referências antes de entrar em contato.',
    },
    {
      title: 'Contato protegido na plataforma',
      description: 'A negociação começa com mais contexto e sem atalhos confusos.',
    },
    {
      title: 'Atendimento mais organizado',
      description: 'Cliente e freelancer continuam a conversa no mesmo fluxo do site.',
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
    <div className="container py-14">
      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div
          className="relative z-0 aspect-[3/1] overflow-hidden bg-slate-100"
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

        <div className="relative z-10 grid gap-8 px-6 pb-8 pt-4 lg:grid-cols-[1.3fr_0.7fr] lg:px-10">
          <div className="-mt-10 space-y-6 sm:-mt-12">
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
                    <h1 className="text-4xl font-semibold leading-none tracking-[-0.05em] text-slate-950 sm:text-[4rem]">
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

            <div className="grid gap-3 sm:grid-cols-3">
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

          <aside className="-mt-10 self-start rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,249,255,0.96)_100%)] p-6 text-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.06)] lg:mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
              Envie sua proposta
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
              Fale com {firstName} com mais contexto
            </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
              Descreva o projeto, o prazo e o objetivo. A comunicação oficial com este freelancer
              acontece apenas no chat interno da plataforma.
              </p>

            {isOwner ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">Este ? o seu perfil p?blico</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Tudo o que os clientes enxergam fica aqui. Use esta pagina para revisar sua
                    apresentacao e atualizar foto ou capa direto na imagem.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">Padrao de imagem</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <p>Foto de perfil: ideal em 800 x 800 px e maximo de 5 MB.</p>
                    <p>Banner do perfil: ideal em 1500 x 500 px e maximo de 8 MB.</p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Use imagens nitidas e com boa luz. O banner funciona melhor no formato
                    horizontal.
                  </p>
                </div>

                <div className="grid gap-3">
                  <Link
                    className="rounded-full bg-[#0071e3] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0077ed]"
                    to="/dashboard/freelancer"
                  >
                    Abrir dashboard
                  </Link>
                  <Link
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    to="/mensagens"
                  >
                    Abrir mensagens
                  </Link>
                </div>
              </div>
            ) : isClient ? (
              <form className="mt-6 grid gap-4" onSubmit={handleContactSubmit}>
                <FormField
                  error={contactErrors.subject}
                  label="Assunto"
                  name="subject"
                  onChange={handleContactChange}
                  placeholder="Ex: orçamento para o serviço que preciso"
                  value={contactForm.subject}
                />
                <FormField
                  error={contactErrors.message}
                  label="Mensagem"
                  name="message"
                  onChange={handleContactChange}
                  onKeyDown={handleContactMessageKeyDown}
                  placeholder="Explique o projeto, prazo e objetivo."
                  textarea
                  value={contactForm.message}
                />

                {contactStatus ? (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      contactStatus.tone === 'success'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {contactStatus.text}
                  </div>
                ) : null}

                <button
                  className="rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={submittingContact}
                  type="submit"
                >
                  {submittingContact ? 'Enviando...' : 'Iniciar chat'}
                </button>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Libere esta etapa quando quiser avançar
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Entre como cliente para usar o chat interno e começar a conversa dentro da
                    plataforma.
                  </p>
                </div>

                <div className="grid gap-3">
                  <Link
                    className="rounded-full bg-[#0071e3] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0077ed]"
                    state={{ from: location }}
                    to="/login"
                  >
                    Entrar para liberar contato
                  </Link>
                  <Link
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    to="/cadastro/cliente"
                  >
                    Criar conta de cliente
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Por que esse fluxo ajuda</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isClient
                  ? 'Sua mensagem chega com contexto do projeto e o histórico fica inteiro dentro da central de mensagens.'
                  : 'Você conhece o profissional primeiro e só libera o contato quando decidir seguir, deixando a navegação mais leve.'}
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Disponibilidade atual</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{freelancer.availability}</p>
            </div>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Regra de comunicação</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Este perfil não entrega telefone, e-mail nem outro atalho de contato. O canal
                oficial entre cliente e freelancer é o chat da plataforma.
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
