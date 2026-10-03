/**
 * Pedagogical Rule-Based Engine & Fallback Generator for Kurikulum Merdeka
 * Used when GEMINI_API_KEY is not configured or when AI services are temporarily unreachable.
 */

export interface FallbackAnalyzeCPParams {
  cpText?: string;
  elements?: { name: string; content: string }[];
  subject?: string;
  grade?: string;
  phase?: string;
  curriculum?: string;
}

export function fallbackAnalyzeCP(params: FallbackAnalyzeCPParams) {
  const subject = params.subject || 'Mata Pelajaran';
  const grade = params.grade || 'Kelas 4';
  const phase = params.phase || 'Fase B';
  const rawText = (params.cpText || '') + ' ' + (params.elements?.map((e) => `${e.name}: ${e.content}`).join(' ') || '');

  // Extract action verbs and competencies
  const commonKKO = [
    'Memahami',
    'Mengidentifikasi',
    'Menganalisis',
    'Menerapkan',
    'Mengevaluasi',
    'Merancang',
    'Mempraktikkan',
    'Menyajikan',
    'Mengomunikasikan',
    'Menciptakan',
    'Menjelaskan',
    'Membandingkan',
  ];

  const matchedCompetencies = commonKKO.filter((kko) =>
    new RegExp(`\\b${kko}\\b`, 'i').test(rawText)
  );

  const finalCompetencies =
    matchedCompetencies.length >= 2
      ? matchedCompetencies.slice(0, 5)
      : ['Memahami konsep dasar', 'Menganalisis dan mengeksplorasi', 'Menerapkan dalam pemecahan masalah', 'Mengomunikasikan hasil pemikiran'];

  // Extract content topics
  const contentTokens = rawText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !['peserta', 'didik', 'mampu', 'dapat', 'pada', 'fase', 'akhir', 'dalam', 'dengan', 'untuk'].includes(w.toLowerCase()));

  const uniqueTokens = Array.from(new Set(contentTokens)).slice(0, 6);
  const keyContents =
    uniqueTokens.length >= 2
      ? uniqueTokens.map((t) => `Konsep dan penerapan ${t}`)
      : [`Konsep esensial ${subject}`, `Keterampilan proses dan penalaran pada ${phase}`, `Aplikasi kontekstual dalam kehidupan sehari-hari`];

  return {
    summary: `Capaian Pembelajaran (CP) untuk ${subject} pada ${grade} (${phase}) menitikberatkan pada penguasaan kompetensi mendasar dan pemahaman konseptual yang bermakna. Peserta didik dibimbing untuk mengintegrasikan pemahaman teori dengan keterampilan praktis serta penalaran kritis sesuai karakteristik perkembangan peserta didik pada fase ini.`,
    keyCompetencies: finalCompetencies,
    keyContents: keyContents,
    p3Focus: ['Bernalar Kritis', 'Mandiri', 'Kreatif', 'Gotong Royong'],
    pedagogicalTips: [
      `Gunakan pendekatan pembelajaran kontekstual berbasis masalah (Problem-Based Learning) yang dekat dengan lingkungan peserta didik ${grade}.`,
      `Lakukan asesmen diagnostik di awal pembelajaran untuk memetakan kesiapan dan minat belajar peserta didik.`,
      `Integrasikan aktivitas kolaboratif berpasangan atau kelompok kecil untuk mengasah dimensi Gotong Royong dan Komunikasi.`,
    ],
  };
}

export interface FallbackGenerateTPParams {
  cpGeneral?: string;
  cpElements?: { name: string; content: string }[];
  cpAnalysisItems?: Array<{
    id: string;
    elementId?: string;
    elementName?: string;
    cpCompetence?: string;
    materialScope?: string;
    suggestedTp?: string;
  }>;
  existingTps?: Array<{
    id: string;
    code?: string;
    elementName?: string;
    statement: string;
    competence?: string;
    contentScope?: string;
    p3Dimensions?: string[];
    cpAnalysisItemIds?: string[];
    order?: number;
  }>;
  subject?: string;
  grade?: string;
  phase?: string;
  curriculum?: string;
  count?: number;
}

export function fallbackGenerateTP(params: FallbackGenerateTPParams) {
  const cpGeneralText = (params.cpGeneral || '').trim();
  const validElements = (params.cpElements || []).filter((e) => e && e.content && e.content.trim().length > 0);
  const cpAnalysisItems = Array.isArray(params.cpAnalysisItems) ? params.cpAnalysisItems : [];
  const existingTps = Array.isArray(params.existingTps) ? params.existingTps : [];

  // INSUFFICIENT CANONICAL SOURCE -> FAIL/BLOCK (return empty)
  if (!cpGeneralText && validElements.length === 0 && cpAnalysisItems.length === 0) {
    return existingTps;
  }

  const grade = params.grade || '';
  const gradeDigits = grade.replace(/\D/g, '');
  const codePrefix = gradeDigits ? `TP ${gradeDigits}.` : 'TP ';
  let counter = 1;

  const rawGeneratedItems: Array<{
    code: string;
    elementName: string;
    statement: string;
    competence: string;
    contentScope: string;
    p3Dimensions: string[];
    graduateProfileDimensions?: string[];
    cpAnalysisItemIds: string[];
  }> = [];

  if (cpAnalysisItems.length > 0) {
    // Generate derived TP directly from each CP Analysis item
    cpAnalysisItems.forEach((cpa) => {
      const elemName = cpa.elementName?.trim() || '';
      const comp = cpa.cpCompetence?.trim() || 'Memahami & Menerapkan';
      const scope = cpa.materialScope?.trim() || '';
      const suggested = cpa.suggestedTp?.trim();

      const statement = suggested && suggested.length > 10
        ? suggested
        : `Peserta didik mampu ${comp.toLowerCase()} ${scope} secara mandiri dan bernalar kritis.`;

      rawGeneratedItems.push({
        code: `${codePrefix}${counter++}`,
        elementName: elemName,
        statement,
        competence: comp,
        contentScope: scope,
        p3Dimensions: ['Bernalar Kritis', 'Mandiri'],
        graduateProfileDimensions: ['Bernalar Kritis', 'Mandiri'],
        cpAnalysisItemIds: cpa.id ? [cpa.id] : [],
      });
    });
  } else if (validElements.length > 0) {
    validElements.forEach((elem) => {
      const elemName = elem.name ? elem.name.trim() : '';
      const cleanContent = elem.content ? elem.content.slice(0, 100).trim() : '';
      if (!cleanContent) return;

      rawGeneratedItems.push({
        code: `${codePrefix}${counter++}`,
        elementName: elemName,
        statement: `Peserta didik mampu memahami dan menerapkan konsep ${elemName ? elemName.toLowerCase() + ' terkait ' : ''}${cleanContent} secara mandiri dan bernalar kritis.`,
        competence: 'Memahami & Menerapkan',
        contentScope: cleanContent,
        p3Dimensions: ['Bernalar Kritis', 'Mandiri'],
        graduateProfileDimensions: ['Bernalar Kritis', 'Mandiri'],
        cpAnalysisItemIds: [],
      });
    });
  } else if (cpGeneralText) {
    rawGeneratedItems.push({
      code: `${codePrefix}${counter++}`,
      elementName: '',
      statement: `Peserta didik mampu memahami dan menjelaskan capaian ${cpGeneralText.slice(0, 100).trim()} secara komprehensif.`,
      competence: 'Memahami & Menjelaskan',
      contentScope: cpGeneralText.slice(0, 80).trim(),
      p3Dimensions: ['Bernalar Kritis', 'Mandiri'],
      graduateProfileDimensions: ['Bernalar Kritis', 'Mandiri'],
      cpAnalysisItemIds: [],
    });
  }

  // Safe merge with existingTps if provided
  if (existingTps.length > 0) {
    const matchedExistingIds = new Set<string>();
    const merged: Array<any> = [];

    for (let i = 0; i < rawGeneratedItems.length; i++) {
      const gen = rawGeneratedItems[i];
      let bestMatch: any = null;
      let highestScore = 3;

      for (const exist of existingTps) {
        if (matchedExistingIds.has(exist.id)) continue;
        let score = 0;

        // cpAnalysisItemIds overlap
        const genIds = gen.cpAnalysisItemIds || [];
        const existIds = exist.cpAnalysisItemIds || [];
        if (genIds.length > 0 && existIds.length > 0 && genIds.some((id) => existIds.includes(id))) {
          score += 10;
        }

        // Element name match
        if (gen.elementName && exist.elementName && gen.elementName.toLowerCase() === exist.elementName.toLowerCase()) {
          score += 4;
        }

        // Content scope match
        if (gen.contentScope && exist.contentScope && (gen.contentScope.toLowerCase().includes(exist.contentScope.toLowerCase()) || exist.contentScope.toLowerCase().includes(gen.contentScope.toLowerCase()))) {
          score += 5;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = exist;
        }
      }

      if (bestMatch) {
        matchedExistingIds.add(bestMatch.id);
        merged.push({
          ...bestMatch,
          id: bestMatch.id, // Mandatory stable ID!
          statement: bestMatch.statement || gen.statement,
          competence: bestMatch.competence || gen.competence,
          contentScope: bestMatch.contentScope || gen.contentScope,
          elementName: bestMatch.elementName || gen.elementName,
          p3Dimensions: bestMatch.p3Dimensions && bestMatch.p3Dimensions.length > 0 ? bestMatch.p3Dimensions : gen.p3Dimensions,
          cpAnalysisItemIds: Array.from(new Set([...(bestMatch.cpAnalysisItemIds || []), ...(gen.cpAnalysisItemIds || [])])),
        });
      } else {
        merged.push({
          ...gen,
          id: `tp-item-${Date.now()}-${i + 1}`,
        });
      }
    }

    // Preserve existing unmatched TPs
    existingTps.forEach((exist) => {
      if (!matchedExistingIds.has(exist.id)) {
        merged.push(exist);
      }
    });

    return merged.map((it, idx) => ({ ...it, order: idx + 1 }));
  }

  return rawGeneratedItems;
}

export interface FallbackGenerateATPParams {
  tps: Array<{
    id?: string;
    code: string;
    statement: string;
    elementName?: string;
    competence?: string;
    contentScope?: string;
    p3Dimensions?: string[];
  }>;
  cpGeneral?: string;
  subject?: string;
  grade?: string;
  phase?: string;
  semester?: string;
  academicYear?: string;
  totalHoursPerWeek?: number;
}

export function fallbackGenerateATP(params: FallbackGenerateATPParams) {
  const subject = params.subject || '';
  const grade = params.grade || '';
  const phase = params.phase || '';
  const tps = params.tps || [];

  const items = tps.map((tp, idx) => {
    const stepNum = idx + 1;
    const material = tp.contentScope || '';
    return {
      stepNumber: stepNum,
      tpId: tp.id || '',
      tpCode: tp.code || '',
      tpStatement: tp.statement || '',
      materialScope: material,
      allocatedJP: null,
      jp: null as any,
      p3Dimensions: tp.p3Dimensions && tp.p3Dimensions.length > 0 ? tp.p3Dimensions : [],
      assessmentPlan: '',
      glossary: '',
      resources: '',
    };
  });

  return {
    rationale: subject && grade
      ? `Alur Tujuan Pembelajaran (ATP) untuk ${subject} ${grade} (${phase}).`
      : 'Alur Tujuan Pembelajaran (ATP).',
    items,
  };
}

export function fallbackRefineText(text: string, instruction?: string, context?: string) {
  if (!text) return '';
  const trimmed = text.trim();
  // Capitalize sentence start and trim multiple spaces
  const clean = trimmed
    .replace(/\s+/g, ' ')
    .replace(/(^\w|\.\s+\w)/gm, (match) => match.toUpperCase());
  return clean;
}

export interface FallbackGenerateLearningPlanParams {
  academicSetting?: {
    subject?: string;
    grade?: string;
    phase?: string;
    curriculum?: string;
    academicYear?: string;
    semester?: string;
  };
  tps?: Array<{
    id?: string;
    code?: string;
    statement?: string;
    contentScope?: string;
    competence?: string;
  }>;
  atpItems?: Array<{
    id?: string;
    stepNumber?: number;
    materialScope?: string;
    jp?: number;
  }>;
  topic?: string;
}

export function fallbackGenerateLearningPlan(params: FallbackGenerateLearningPlanParams) {
  const subject = params.academicSetting?.subject || '';
  const grade = params.academicSetting?.grade || '';
  const tps = params.tps || [];
  const primaryTp = tps[0];
  const topicName = params.topic || primaryTp?.contentScope || primaryTp?.statement || `Topik Pembelajaran ${subject}`.trim();
  const tpCodeStr = primaryTp?.code ? `[${primaryTp.code}] ` : '';
  const linkedTpIds = tps.map((t) => t.id).filter(Boolean) as string[];

  return {
    title: `Draf Modul Ajar: ${topicName}`,
    topic: topicName,
    meaningfulUnderstanding: `Murid memahami konsep esensial ${topicName} dan mampu menerapkannya secara mandiri serta kritis dalam konteks kehidupan sehari-hari.`,
    triggerQuestions: [
      `Mengapa pemahaman tentang ${topicName} penting dalam kehidupan sehari-hari?`,
      `Bagaimana kita dapat menerapkan konsep ini untuk menyelesaikan permasalahan di lingkungan sekitar?`
    ],
    learningExperiences: [
      {
        id: `exp-1-${Date.now()}`,
        phase: 'UNDERSTAND',
        description: `Murid mengamati contoh kontekstual, mendiskusikan konsep dasar ${topicName}, dan mengidentifikasi bagian-bagian utamanya.`,
        durationMinutes: 35,
        linkedTpIds
      },
      {
        id: `exp-2-${Date.now()}`,
        phase: 'APPLY',
        description: `Murid secara berpasangan/kelompok melakukan eksplorasi dan menyelesaikan latihan penerapan ${topicName}.`,
        durationMinutes: 45,
        linkedTpIds
      },
      {
        id: `exp-3-${Date.now()}`,
        phase: 'REFLECT',
        description: `Murid menyimpulkan pemahaman, melakukan refleksi diri tentang tantangan belajar, dan merencanakan langkah perbaikan.`,
        durationMinutes: 20,
        linkedTpIds
      }
    ],
    deepLearningContext: {
      principles: ['MINDFUL', 'MEANINGFUL', 'JOYFUL'],
      graduateProfileDimensions: ['Bernalar Kritis', 'Mandiri']
    },
    graduateProfileDimensions: ['Bernalar Kritis', 'Mandiri'],
    learningSteps: {
      opening: [
        {
          id: `step-open-${Date.now()}`,
          stepName: 'Kegiatan Awal / Apersepsi',
          description: `Guru menyapa murid, memeriksa presensi, menyampaikan tujuan pembelajaran ${tpCodeStr}${topicName}, serta memberikan pertanyaan pemantik.`,
          durationMinutes: 10
        }
      ],
      core: [
        {
          id: `step-core-${Date.now()}`,
          stepName: 'Kegiatan Inti (Eksplorasi & Aplikasi)',
          description: `Murid terlibat aktif dalam aktivitas berkesadaran dan pemecahan masalah ${topicName} secara terbimbing dan mandiri.`,
          durationMinutes: 70
        }
      ],
      closing: [
        {
          id: `step-close-${Date.now()}`,
          stepName: 'Kegiatan Penutup & Refleksi',
          description: `Guru dan murid merangkum poin penting pembelajaran, melakukan refleksi, dan menyampaikan tindak lanjut untuk pertemuan berikutnya.`,
          durationMinutes: 10
        }
      ]
    },
    assessmentPlan: {
      initial: [
        {
          id: `asm-init-${Date.now()}`,
          type: 'INITIAL',
          technique: 'Tanya Jawab / Diagnostik Singkat',
          description: `Mengecek kesiapan dan pengetahuan awal murid mengenai ${topicName}.`,
          linkedTpIds
        }
      ],
      formative: [
        {
          id: `asm-form-${Date.now()}`,
          type: 'FORMATIVE',
          technique: 'Observasi Performa & Diskusi Kelompok',
          description: `Memantau keterlibatan, pemahaman konsep, dan sikap kolaboratif murid selama proses belajar.`,
          linkedTpIds
        }
      ],
      summative: [
        {
          id: `asm-sum-${Date.now()}`,
          type: 'SUMMATIVE',
          technique: 'Tes Subformatif / Unjuk Kerja',
          description: `Mengukur pencapaian Tujuan Pembelajaran ${tpCodeStr} pada akhir topik.`,
          linkedTpIds
        }
      ]
    },
    differentiation: {
      content: `Penyediaan materi visual/teks sesuai kesiapan belajar murid.`,
      process: `Bimbingan khusus bagi murid yang memerlukan pendampingan dan tantangan tambahan bagi yang cepat paham.`,
      product: `Murid diberikan pilihan bentuk penyajian hasil tugas (diagram, tulisan, atau presentasi lisan).`
    },
    reflection: {
      teacher: `Apakah seluruh murid mencapai target pembelajaran? Kendala apa yang dihadapi dan bagaimana solusinya?`,
      student: `Bagian mana dari pembelajaran ${topicName} yang paling menarik dan bagian mana yang masih memerlukan latihan?`
    },
    enrichmentPlan: `Pemberian soal tantangan kontekstual tingkat lanjut bagi murid dengan pencapaian di atas rata-rata.`,
    remedialPlan: `Bimbingan perorangan/kelompok kecil dan penyederhanaan latihan bagi murid yang belum tuntas.`,
    resources: [
      { id: `res-1-${Date.now()}`, title: `Buku Siswa ${subject} ${grade}`.trim() },
      { id: `res-2-${Date.now()}`, title: `Lembar Kerja Murid (LKM) ${topicName}` }
    ],
    allocatedJP: params.atpItems && params.atpItems.length > 0 ? params.atpItems.reduce((acc, curr) => acc + (curr.jp || 2), 0) : 2
  };
}

export interface FallbackATPMappingParams {
  atpItems: Array<{
    id: string;
    stepNumber?: number;
    tpCode?: string;
    tpStatement?: string;
    unitTitle?: string;
    materialScope?: string;
  }>;
  targetUnitCount: number;
  teacherUnits: Record<number, string>;
  subject?: string;
}

export function fallbackGenerateATPMapping(params: FallbackATPMappingParams) {
  const { atpItems, targetUnitCount, teacherUnits, subject = 'Mata Pelajaran' } = params;
  const count = Math.max(1, Math.min(20, targetUnitCount || 6));
  const totalItems = Math.max(1, atpItems.length);

  // Build units list
  const units: Array<{ unitIndex: number; unitTitle: string; description: string }> = [];
  for (let u = 1; u <= count; u++) {
    const existingTitle = teacherUnits[u];
    const unitTitle =
      existingTitle && existingTitle.trim().length > 0
        ? existingTitle.trim()
        : `Bab ${u}: Pembelajaran ${subject} Bagian ${u}`;
    units.push({
      unitIndex: u,
      unitTitle,
      description: `Materi pembelajaran unit ke-${u}`,
    });
  }

  // Distribute ATP items across units chronologically
  const mappings: Array<{ atpItemId: string; unitTitle: string; materialScope: string }> = [];

  atpItems.forEach((item, idx) => {
    // Calculate which unit this item falls into (balanced distribution)
    const unitIdx = Math.min(count, Math.floor((idx / totalItems) * count) + 1);
    const assignedUnit = units.find((u) => u.unitIndex === unitIdx) || units[0];

    const finalUnitTitle =
      item.unitTitle && item.unitTitle.trim().length > 0
        ? item.unitTitle.trim()
        : assignedUnit.unitTitle;

    let derivedMaterial =
      item.materialScope && item.materialScope.trim().length > 0
        ? item.materialScope.trim()
        : '';

    if (!derivedMaterial) {
      if (item.tpStatement) {
        // Extract meaningful topic from TP statement
        const cleanStmt = item.tpStatement.replace(/^(peserta didik|murid|siswa)\s+(dapat|mampu)\s+/i, '');
        derivedMaterial = cleanStmt.length > 60 ? `${cleanStmt.substring(0, 57)}...` : cleanStmt;
      } else {
        derivedMaterial = `Materi Pokok Langkah #${item.stepNumber || idx + 1}`;
      }
    }

    mappings.push({
      atpItemId: item.id,
      unitTitle: finalUnitTitle,
      materialScope: derivedMaterial,
    });
  });

  return {
    units,
    mappings,
  };
}

export interface FallbackCanonicalUnitMappingParams {
  academicSettingId?: string;
  subject?: string;
  grade?: string;
  phase?: string;
  tpData: {
    id?: string;
    items: Array<{
      id: string;
      code?: string;
      elementName?: string;
      statement: string;
      competence?: string;
      contentScope?: string;
      cpAnalysisId?: string;
      cpAnalysisItemIds?: string[];
      order?: number;
    }>;
  };
  atpData: {
    id?: string;
    items: Array<{
      id: string;
      stepNumber: number;
      tpId?: string;
      tpCode?: string;
      tpStatement?: string;
      unitTitle?: string;
      materialScope?: string;
    }>;
  };
  cpAnalysisData?: {
    id?: string;
    items?: Array<{
      id: string;
      elementId?: string;
      elementName: string;
      cpCompetence: string;
      materialScope: string;
      suggestedTp?: string;
    }>;
  };
  existingMapping?: {
    id?: string;
    academicSettingId?: string;
    atpId?: string;
    tpDataId?: string;
    units: Array<{
      id: string;
      title: string;
      order: number;
      linkedTpIds: string[];
      linkedAtpItemIds: string[];
      materials: Array<{
        id: string;
        title: string;
        order: number;
        linkedTpIds: string[];
        linkedAtpItemIds: string[];
      }>;
    }>;
  };
  targetUnitCount?: number;
  targetMaterialCountPerUnit?: number;
}

export function fallbackGenerateCanonicalATPUnitMapping(
  params: FallbackCanonicalUnitMappingParams
) {
  const {
    academicSettingId = '',
    subject = 'Mata Pelajaran',
    tpData,
    atpData,
    cpAnalysisData,
    existingMapping,
    targetUnitCount = 6,
  } = params;

  const validTpItems = Array.isArray(tpData?.items) ? tpData.items : [];
  const tpMap = new Map<string, (typeof validTpItems)[0]>();
  validTpItems.forEach((tp) => tpMap.set(tp.id, tp));

  const validAtpItems = Array.isArray(atpData?.items)
    ? [...atpData.items].sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0))
    : [];
  const atpMap = new Map<string, (typeof validAtpItems)[0]>();
  validAtpItems.forEach((atp) => atpMap.set(atp.id, atp));

  const cpAnalysisItems = Array.isArray(cpAnalysisData?.items) ? cpAnalysisData.items : [];
  const cpaMap = new Map<string, (typeof cpAnalysisItems)[0]>();
  cpAnalysisItems.forEach((cpa) => cpaMap.set(cpa.id, cpa));

  // Indonesian stopwords for semantic keyword extraction
  const STOPWORDS = new Set([
    'dan', 'atau', 'pada', 'dalam', 'dengan', 'untuk', 'secara', 'yang', 'serta',
    'dapat', 'mampu', 'peserta', 'didik', 'siswa', 'murid', 'pembelajaran', 'materi',
    'konsep', 'memahami', 'mengidentifikasi', 'menjelaskan', 'mempraktikkan', 'menganalisis',
    'merancang', 'melakukan', 'tentang', 'terhadap', 'sebagai', 'melalui', 'proses',
    'tahap', 'bagian', 'berbagai', 'macam', 'jenis', 'dasar', 'awal', 'akhir', 'menggunakan'
  ]);

  const extractKeywords = (text: string): string[] => {
    if (!text) return [];
    const clean = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
    const tokens = clean.split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
    return Array.from(new Set(tokens));
  };

  // Helper to extract clean content summary from TP
  const extractTopicFromTp = (tp?: (typeof validTpItems)[0]): string => {
    if (!tp) return 'Materi Pembelajaran';
    if (tp.contentScope && tp.contentScope.trim().length > 0) {
      return tp.contentScope.trim();
    }
    // Check linked CP analysis
    if (tp.cpAnalysisItemIds && tp.cpAnalysisItemIds.length > 0) {
      for (const cpaId of tp.cpAnalysisItemIds) {
        const cpa = cpaMap.get(cpaId);
        if (cpa && cpa.materialScope && cpa.materialScope.trim().length > 0) {
          return cpa.materialScope.trim();
        }
      }
    }
    const cleanStmt = (tp.statement || '')
      .replace(/^(peserta didik|murid|siswa)\s+(dapat|mampu)\s+/i, '')
      .trim();
    return cleanStmt.length > 60 ? `${cleanStmt.substring(0, 57)}...` : cleanStmt || 'Materi Pembelajaran';
  };

  const isCrossCuttingTp = (tp?: (typeof validTpItems)[0]): boolean => {
    if (!tp) return false;
    const full = `${tp.statement || ''} ${tp.contentScope || ''} ${tp.elementName || ''}`.toLowerCase();
    return (
      full.includes('profil pelajar pancasila') ||
      full.includes('profil lulusan') ||
      full.includes('karakter') ||
      full.includes('tanggung jawab') ||
      full.includes('refleksi') ||
      full.includes('evaluasi diri') ||
      full.includes('kebugaran') ||
      full.includes('sikap') ||
      full.includes('kolaborasi')
    );
  };

  const areTpsSemanticallyRelated = (
    tpA?: (typeof validTpItems)[0],
    tpB?: (typeof validTpItems)[0]
  ): boolean => {
    if (!tpA || !tpB) return false;
    if (tpA.id === tpB.id) return true;

    // Cross-cutting TP can integrate with neighboring content
    if (isCrossCuttingTp(tpA) || isCrossCuttingTp(tpB)) {
      return true;
    }

    // Direct contentScope match
    const scopeA = tpA.contentScope?.trim().toLowerCase();
    const scopeB = tpB.contentScope?.trim().toLowerCase();
    if (scopeA && scopeB && (scopeA === scopeB || scopeA.includes(scopeB) || scopeB.includes(scopeA))) {
      return true;
    }

    // Keyword overlap on scope or statement
    const kwA = extractKeywords(`${tpA.contentScope || ''} ${tpA.statement || ''}`);
    const kwB = extractKeywords(`${tpB.contentScope || ''} ${tpB.statement || ''}`);
    const overlap = kwA.filter((k) => kwB.includes(k));
    return overlap.length >= 1;
  };

  // If existingMapping has units, strictly preserve teacher structure and only complete missing fields
  if (existingMapping && Array.isArray(existingMapping.units) && existingMapping.units.length > 0) {
    const updatedUnits = existingMapping.units.map((unit, uIdx) => {
      const order = unit.order || uIdx + 1;
      const linkedTpIds = (unit.linkedTpIds || []).filter((id) => tpMap.has(id));
      const linkedAtpItemIds = (unit.linkedAtpItemIds || []).filter((id) => atpMap.has(id));
      const linkedTps = linkedTpIds.map((id) => tpMap.get(id)).filter(Boolean);

      let unitTitle = unit.title?.trim();
      if (!unitTitle) {
        const fallbackTopic = linkedTps.length > 0 ? extractTopicFromTp(linkedTps[0]) : `Bagian ${order}`;
        unitTitle = `Bab ${order}: ${fallbackTopic}`;
      }

      let materials = Array.isArray(unit.materials) ? [...unit.materials] : [];
      if (materials.length > 0) {
        materials = materials.map((mat, mIdx) => {
          const matOrder = mat.order || mIdx + 1;
          const matLinkedTpIds = (mat.linkedTpIds || []).filter((id) => tpMap.has(id));
          const matLinkedAtpItemIds = (mat.linkedAtpItemIds || []).filter((id) => atpMap.has(id));

          let matTitle = mat.title?.trim();
          if (!matTitle) {
            const topic = matLinkedTpIds.length > 0 && tpMap.get(matLinkedTpIds[0])
              ? extractTopicFromTp(tpMap.get(matLinkedTpIds[0]))
              : (linkedTps[mIdx] ? extractTopicFromTp(linkedTps[mIdx]) : `Lingkup Materi ${matOrder}`);
            matTitle = topic;
          }

          return {
            id: mat.id || `mat-${Date.now()}-${uIdx + 1}-${matOrder}`,
            title: matTitle,
            order: matOrder,
            linkedTpIds: matLinkedTpIds.length > 0 ? matLinkedTpIds : linkedTpIds,
            linkedAtpItemIds: matLinkedAtpItemIds.length > 0 ? matLinkedAtpItemIds : linkedAtpItemIds,
          };
        });
      } else {
        // Decompose unit into distinct supported material scopes from linked TPs (NO generic invention)
        const distinctScopes: string[] = [];
        linkedTps.forEach((tp) => {
          const t = extractTopicFromTp(tp);
          if (t && !distinctScopes.some((s) => s.toLowerCase() === t.toLowerCase())) {
            distinctScopes.push(t);
          }
        });

        if (distinctScopes.length > 0) {
          materials = distinctScopes.map((scopeTitle, mIdx) => {
            const supportingTps = linkedTps.filter((t) => extractTopicFromTp(t).toLowerCase() === scopeTitle.toLowerCase());
            const supportingTpIds = supportingTps.map((t) => t!.id);
            const matchingAtps = validAtpItems.filter((atp) => supportingTpIds.includes(atp.tpId || ''));
            return {
              id: `mat-${Date.now()}-${uIdx + 1}-${mIdx + 1}`,
              title: scopeTitle,
              order: mIdx + 1,
              linkedTpIds: supportingTpIds.length > 0 ? supportingTpIds : linkedTpIds,
              linkedAtpItemIds: matchingAtps.length > 0 ? matchingAtps.map((a) => a.id) : linkedAtpItemIds,
            };
          });
        } else {
          // If no TPs linked yet, create 1 material referencing the unit title
          materials = [
            {
              id: `mat-${Date.now()}-${uIdx + 1}-1`,
              title: unitTitle.replace(/^Bab\s+\d+:\s*/i, ''),
              order: 1,
              linkedTpIds: linkedTpIds,
              linkedAtpItemIds: linkedAtpItemIds,
            },
          ];
        }
      }

      return {
        id: unit.id || `unit-${Date.now()}-${order}`,
        title: unitTitle,
        order,
        linkedTpIds,
        linkedAtpItemIds,
        materials,
      };
    });

    return {
      id: existingMapping.id || `aum-${Date.now()}`,
      academicSettingId: existingMapping.academicSettingId || academicSettingId,
      atpId: atpData.id || '',
      tpDataId: tpData.id || '',
      units: updatedUnits,
      updatedAt: new Date().toISOString(),
    };
  }

  // Initial Generation: Deterministic Semantic Clustering along canonical ATP sequence
  const targetCount = Math.max(1, Math.min(20, targetUnitCount || 6));

  // Build semantic clusters along ATP chronological sequence
  const rawClusters: Array<(typeof validAtpItems)> = [];
  let currentCluster: (typeof validAtpItems) = [];

  validAtpItems.forEach((atp) => {
    if (currentCluster.length === 0) {
      currentCluster.push(atp);
    } else {
      const atpTp = atp.tpId ? tpMap.get(atp.tpId) : undefined;
      // Check relationship with existing TPs in current cluster
      const clusterTps = currentCluster.map((a) => (a.tpId ? tpMap.get(a.tpId) : undefined)).filter(Boolean);
      const isRelated = clusterTps.some((cTp) => areTpsSemanticallyRelated(atpTp, cTp));

      if (isRelated) {
        currentCluster.push(atp);
      } else {
        rawClusters.push(currentCluster);
        currentCluster = [atp];
      }
    }
  });

  if (currentCluster.length > 0) {
    rawClusters.push(currentCluster);
  }

  // Organic balancing against targetCount (NEVER arithmetic division, only sequence-preserving merges/splits)
  let semanticClusters = rawClusters;

  // If there are too many small adjacent clusters compared to targetCount, merge most related adjacent ones
  while (semanticClusters.length > targetCount && semanticClusters.length > 1) {
    let bestMergeIdx = 0;
    let highestSimilarity = -1;

    for (let i = 0; i < semanticClusters.length - 1; i++) {
      const c1 = semanticClusters[i];
      const c2 = semanticClusters[i + 1];
      const tp1 = c1.map((a) => (a.tpId ? tpMap.get(a.tpId) : undefined)).filter(Boolean);
      const tp2 = c2.map((a) => (a.tpId ? tpMap.get(a.tpId) : undefined)).filter(Boolean);

      let sim = 0;
      tp1.forEach((t1) => {
        tp2.forEach((t2) => {
          if (areTpsSemanticallyRelated(t1, t2)) sim += 2;
          const kw1 = extractKeywords(t1?.statement || '');
          const kw2 = extractKeywords(t2?.statement || '');
          sim += kw1.filter((k) => kw2.includes(k)).length;
        });
      });

      // Prefer merging small single-item clusters
      if (c1.length === 1 || c2.length === 1) sim += 1;

      if (sim > highestSimilarity) {
        highestSimilarity = sim;
        bestMergeIdx = i;
      }
    }

    const merged = [...semanticClusters[bestMergeIdx], ...semanticClusters[bestMergeIdx + 1]];
    semanticClusters.splice(bestMergeIdx, 2, merged);
  }

  // Build Bab units from the semantic clusters
  const units: Array<{
    id: string;
    title: string;
    order: number;
    linkedTpIds: string[];
    linkedAtpItemIds: string[];
    materials: Array<{
      id: string;
      title: string;
      order: number;
      linkedTpIds: string[];
      linkedAtpItemIds: string[];
    }>;
  }> = [];

  semanticClusters.forEach((cluster, cIdx) => {
    const unitOrder = cIdx + 1;
    const unitId = `unit-${Date.now()}-${unitOrder}`;
    const linkedAtpItemIds = cluster.map((a) => a.id);
    const linkedTpIdsSet = new Set<string>();
    cluster.forEach((a) => {
      if (a.tpId && tpMap.has(a.tpId)) {
        linkedTpIdsSet.add(a.tpId);
      }
    });
    const linkedTpIds = Array.from(linkedTpIdsSet);
    const linkedTps = linkedTpIds.map((id) => tpMap.get(id)).filter(Boolean);

    // Determine representative Bab title from dominant content scope
    let mainTopic = '';
    const nonCrossCuttingTps = linkedTps.filter((t) => !isCrossCuttingTp(t));
    const titleCandidates = (nonCrossCuttingTps.length > 0 ? nonCrossCuttingTps : linkedTps)
      .map((t) => extractTopicFromTp(t))
      .filter((s) => s.length > 0);

    if (titleCandidates.length > 0) {
      mainTopic = titleCandidates[0];
    } else {
      mainTopic = `Materi Pembelajaran Bagian ${unitOrder}`;
    }

    const unitTitle = `Bab ${unitOrder}: ${mainTopic.replace(/^(bab|unit)\s*\d*[:\-]?\s*/i, '')}`;

    // Decompose into distinct supported Lingkup Materi (No generic inventions, no forced min 2)
    const materials: Array<{
      id: string;
      title: string;
      order: number;
      linkedTpIds: string[];
      linkedAtpItemIds: string[];
    }> = [];

    // Collect all genuine material scopes from linked TPs and CP Analysis items
    const distinctScopeMap = new Map<string, { tpIds: Set<string>; atpIds: Set<string> }>();

    linkedTps.forEach((tp) => {
      const scopeTitle = extractTopicFromTp(tp);
      const normalizedKey = scopeTitle.toLowerCase().trim();

      if (!distinctScopeMap.has(normalizedKey)) {
        distinctScopeMap.set(normalizedKey, { tpIds: new Set(), atpIds: new Set() });
      }

      const entry = distinctScopeMap.get(normalizedKey)!;
      entry.tpIds.add(tp!.id);
      cluster.filter((a) => a.tpId === tp!.id).forEach((a) => entry.atpIds.add(a.id));
    });

    let matIndex = 1;
    distinctScopeMap.forEach((entry, normKey) => {
      // Find original casing
      const originalTp = linkedTps.find((t) => extractTopicFromTp(t).toLowerCase().trim() === normKey);
      const title = originalTp ? extractTopicFromTp(originalTp) : normKey;

      const matTpIds = Array.from(entry.tpIds);
      const matAtpIds = Array.from(entry.atpIds);

      materials.push({
        id: `mat-${Date.now()}-${unitOrder}-${matIndex}`,
        title,
        order: matIndex,
        linkedTpIds: matTpIds.length > 0 ? matTpIds : linkedTpIds,
        linkedAtpItemIds: matAtpIds.length > 0 ? matAtpIds : linkedAtpItemIds,
      });
      matIndex++;
    });

    // If somehow no materials extracted, use the main topic as the single supported material
    if (materials.length === 0) {
      materials.push({
        id: `mat-${Date.now()}-${unitOrder}-1`,
        title: mainTopic.replace(/^(bab|unit)\s*\d*[:\-]?\s*/i, ''),
        order: 1,
        linkedTpIds,
        linkedAtpItemIds,
      });
    }

    units.push({
      id: unitId,
      title: unitTitle,
      order: unitOrder,
      linkedTpIds,
      linkedAtpItemIds,
      materials,
    });
  });

  return {
    id: `aum-${Date.now()}`,
    academicSettingId,
    atpId: atpData.id || '',
    tpDataId: tpData.id || '',
    units,
    updatedAt: new Date().toISOString(),
  };
}



