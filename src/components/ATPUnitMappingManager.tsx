import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderTree,
  ArrowRight,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  BookOpen,
  Tag,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ATPData, ATPItem, TPData, AcademicSetting } from '../types';
import { generateATPMappingWithAI, TeacherUnitConstraint } from '../services/aiService';

export interface ATPUnitMappingManagerProps {
  atp: ATPData;
  tp: TPData;
  academicSetting?: AcademicSetting;
  onSaveATP: (updatedAtp: ATPData) => void;
  onNextStep: () => void;
  onBackToATP: () => void;
}

export const ATPUnitMappingManager: React.FC<ATPUnitMappingManagerProps> = ({
  atp,
  tp,
  academicSetting,
  onSaveATP,
  onNextStep,
  onBackToATP,
}) => {
  // Sort items by canonical stepNumber
  const sortedInitialItems = useMemo(() => {
    return [...(atp.items || [])].sort(
      (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
    );
  }, [atp.items]);

  const [items, setItems] = useState<ATPItem[]>(sortedInitialItems);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Initial unit extraction from existing items
  const initialExtractedUnits = useMemo(() => {
    const list: string[] = [];
    sortedInitialItems.forEach((it) => {
      const u = it.unitTitle?.trim();
      if (u && !list.includes(u)) {
        list.push(u);
      }
    });
    return list;
  }, [sortedInitialItems]);

  // Target count of Bab (default 6 or existing count)
  const [targetUnitCount, setTargetUnitCount] = useState<number>(() => {
    if (initialExtractedUnits.length > 0) {
      return Math.max(1, Math.min(15, initialExtractedUnits.length));
    }
    return 6;
  });

  // Teacher directed Bab list (array of strings of length targetUnitCount)
  const [teacherBabList, setTeacherBabList] = useState<string[]>(() => {
    const arr: string[] = [];
    const count = initialExtractedUnits.length > 0 ? initialExtractedUnits.length : 6;
    for (let i = 0; i < count; i++) {
      arr.push(initialExtractedUnits[i] || '');
    }
    return arr;
  });

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [isBabListOpen, setIsBabListOpen] = useState(true);

  // Sync state if atp.items updates from outside
  useEffect(() => {
    const sorted = [...(atp.items || [])].sort(
      (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
    );
    setItems(sorted);
    setHasChanges(false);

    // Extract unique units to initialize or refresh Bab list if empty
    const uniqueUnits: string[] = [];
    sorted.forEach((it) => {
      const u = it.unitTitle?.trim();
      if (u && !uniqueUnits.includes(u)) {
        uniqueUnits.push(u);
      }
    });

    if (uniqueUnits.length > 0) {
      setTeacherBabList((prev) => {
        // If current list has teacher edits, preserve them
        const hasExisting = prev.some((p) => p.trim().length > 0);
        if (hasExisting) return prev;
        const newArr = [...prev];
        uniqueUnits.forEach((u, i) => {
          newArr[i] = u;
        });
        return newArr;
      });
    }
  }, [atp.items]);

  // Adjust teacherBabList length when targetUnitCount changes
  const handleTargetCountChange = (newCount: number) => {
    const clamped = Math.max(1, Math.min(15, newCount));
    setTargetUnitCount(clamped);
    setTeacherBabList((prev) => {
      const copy = [...prev];
      while (copy.length < clamped) {
        copy.push('');
      }
      return copy.slice(0, clamped);
    });
  };

  const handleTeacherBabNameChange = (index: number, value: string) => {
    setTeacherBabList((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleAddBabSlot = () => {
    handleTargetCountChange(targetUnitCount + 1);
  };

  const handleRemoveBabSlot = (index: number) => {
    if (targetUnitCount <= 1) return;
    setTeacherBabList((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      return copy;
    });
    setTargetUnitCount((prev) => Math.max(1, prev - 1));
  };

  // Resolve TP map for easy lookup
  const tpMap = useMemo(() => {
    const map = new Map<string, { code?: string; statement?: string; contentScope?: string }>();
    (tp.items || []).forEach((t) => {
      map.set(t.id, t);
    });
    return map;
  }, [tp.items]);

  // Collect unique existing unit titles for datalist suggestions
  const existingUnitTitles = useMemo(() => {
    const titles = new Set<string>();
    teacherBabList.forEach((b) => {
      if (b.trim().length > 0) titles.add(b.trim());
    });
    items.forEach((it) => {
      if (it.unitTitle && it.unitTitle.trim().length > 0) {
        titles.add(it.unitTitle.trim());
      }
    });
    return Array.from(titles);
  }, [teacherBabList, items]);

  // Unit grouping breakdown
  const unitStats = useMemo(() => {
    const groups: Record<string, number> = {};
    let unassigned = 0;
    items.forEach((it) => {
      const u = it.unitTitle?.trim();
      if (u) {
        groups[u] = (groups[u] || 0) + 1;
      } else {
        unassigned++;
      }
    });
    return { groups, unassigned };
  }, [items]);

  const handleFieldChange = (
    index: number,
    field: 'unitTitle' | 'materialScope',
    value: string
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return copy;
    });
    setHasChanges(true);
    setSaveSuccessNotice(false);
  };

  // AI Generation with Teacher-Directed Constraint & Strict Merge Safety
  const handleGenerateAIMapping = async () => {
    if (items.length === 0) {
      setAiError('Daftar langkah ATP masih kosong. Susun ATP terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      // Build teacher unit constraints: only pass non-empty teacher Bab names
      const teacherConstraints: TeacherUnitConstraint[] = [];
      teacherBabList.forEach((title, idx) => {
        if (title && title.trim().length > 0) {
          teacherConstraints.push({
            unitIndex: idx + 1,
            unitTitle: title.trim(),
          });
        }
      });

      const payload = {
        atpItems: items.map((it, idx) => ({
          id: it.id,
          stepNumber: it.stepNumber || idx + 1,
          tpCode: it.tpCode || `TP-${idx + 1}`,
          tpStatement: it.tpStatement || tpMap.get(it.tpId)?.statement || '',
          unitTitle: it.unitTitle?.trim() || undefined,
          materialScope: it.materialScope?.trim() || undefined,
        })),
        subject: academicSetting?.subject || 'Mata Pelajaran',
        grade: academicSetting?.grade || 'Kelas',
        phase: academicSetting?.phase || 'Fase',
        targetUnitCount,
        teacherUnits: teacherConstraints,
      };

      const result = await generateATPMappingWithAI(payload);

      // Update teacherBabList with AI proposed units if empty
      if (result.units && Array.isArray(result.units) && result.units.length > 0) {
        setTeacherBabList((prevList) => {
          const updated = [...prevList];
          result.units.forEach((u) => {
            const idx = u.unitIndex - 1;
            if (idx >= 0 && idx < updated.length) {
              // Preserve non-empty teacher value! Only fill empty
              if (!updated[idx] || updated[idx].trim().length === 0) {
                updated[idx] = u.unitTitle;
              }
            } else if (idx >= updated.length && idx < targetUnitCount) {
              updated.push(u.unitTitle);
            }
          });
          return updated;
        });
      }

      // CRITICAL MERGE SAFETY RULE:
      // Teacher input has highest priority!
      // AI may COMPLETE missing mapping but must NEVER overwrite a non-empty teacher value!
      let completedCount = 0;
      setItems((prevItems) => {
        return prevItems.map((currentItem) => {
          const aiMapping = result.mappings.find((m) => m.atpItemId === currentItem.id);
          if (!aiMapping) return currentItem;

          const currentUnit = currentItem.unitTitle?.trim();
          const currentScope = currentItem.materialScope?.trim();

          const isUnitEmpty = !currentUnit || currentUnit.length === 0;
          const isScopeEmpty = !currentScope || currentScope.length === 0;

          if (isUnitEmpty || isScopeEmpty) {
            completedCount++;
          }

          // Strict preservation:
          const finalUnitTitle = !isUnitEmpty ? currentUnit! : (aiMapping.unitTitle || '');
          const finalMaterialScope = !isScopeEmpty ? currentScope! : (aiMapping.materialScope || '');

          return {
            ...currentItem,
            unitTitle: finalUnitTitle,
            materialScope: finalMaterialScope,
          };
        });
      });

      setHasChanges(true);
      setAiSuccessMessage(
        `AI berhasil menyusun pemetaan untuk ${targetUnitCount} Bab. Nilai yang sudah Anda isi tetap dipertahankan secara utuh.`
      );
      setTimeout(() => setAiSuccessMessage(null), 6000);
    } catch (err: any) {
      setAiError(err.message || 'Gagal menghasilkan pemetaan Unit/Bab dengan AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const updatedATP: ATPData = {
      ...atp,
      items: items.map((it, idx) => ({
        ...it,
        stepNumber: it.stepNumber || idx + 1,
      })),
      updatedAt: new Date().toISOString(),
    };

    onSaveATP(updatedATP);
    setHasChanges(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3500);
  };

  const handleProceedNext = () => {
    if (hasChanges) {
      const updatedATP: ATPData = {
        ...atp,
        items: items.map((it, idx) => ({
          ...it,
          stepNumber: it.stepNumber || idx + 1,
        })),
        updatedAt: new Date().toISOString(),
      };
      onSaveATP(updatedATP);
    }
    onNextStep();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 text-xs font-bold flex items-center justify-center">
                07
              </span>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-blue-700" />
                <span>Pemetaan ATP ke Unit / Bab & Lingkup Materi</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Petakan alur tujuan pembelajaran (ATP) ke dalam <strong>Unit / Bab operasional</strong> dan tentukan fokus <strong>Lingkup Materi Inti</strong>. Anda dapat menentukan nama Bab sendiri, menggunakan bantuan AI terarah, atau memetakan secara manual.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-save-mapping"
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 transition cursor-pointer shadow-xs disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Pemetaan</span>
            </button>
          </div>
        </div>

        {/* Status / Saved Alert */}
        {saveSuccessNotice && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Perubahan pemetaan Unit/Bab dan Lingkup Materi berhasil disimpan ke data ATP.</span>
          </div>
        )}

        {hasChanges && !saveSuccessNotice && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Terdapat perubahan Unit/Bab atau Lingkup Materi yang belum disimpan. Klik "Simpan Pemetaan" atau lanjutkan untuk menyimpan otomatis.</span>
          </div>
        )}
      </div>

      {/* Teacher-Directed AI Generator Control Card */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Asisten Pemetaan Unit AI</span>
              </span>
              <h4 className="text-sm font-bold text-slate-900">
                Pengaturan Target Bab & Pemetaan Otomatis
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              Tentukan target jumlah Bab dan ketik nama Bab pilihan Anda (opsional). AI akan mempertahankan input Anda dan melengkapi sisanya secara proporsional.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Target Count Input */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <label htmlFor="target-unit-count" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Target Jumlah Bab:
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleTargetCountChange(targetUnitCount - 1)}
                  disabled={targetUnitCount <= 1 || isGenerating}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center text-xs font-bold disabled:opacity-40"
                >
                  -
                </button>
                <input
                  id="target-unit-count"
                  type="number"
                  min={1}
                  max={15}
                  value={targetUnitCount}
                  onChange={(e) => handleTargetCountChange(parseInt(e.target.value, 10) || 1)}
                  disabled={isGenerating}
                  className="w-12 text-center text-xs font-bold py-0.5 rounded-md border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleTargetCountChange(targetUnitCount + 1)}
                  disabled={targetUnitCount >= 15 || isGenerating}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center text-xs font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* AI Generate Button */}
            <button
              id="btn-generate-ai-mapping"
              type="button"
              onClick={handleGenerateAIMapping}
              disabled={isGenerating || items.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Menyusun Pemetaan AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Generate Pemetaan AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Alerts */}
        {aiError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{aiError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="text-xs font-bold text-rose-600 hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {aiSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{aiSuccessMessage}</span>
          </div>
        )}

        {/* Teacher Directed Bab Name Inputs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsBabListOpen(!isBabListOpen)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 cursor-pointer"
            >
              <span>Daftar Nama Bab ({targetUnitCount} Bab Target)</span>
              {isBabListOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <span className="text-[11px] text-slate-400">
              Ketik nama Bab jika ingin menentukan sendiri, kosongkan agar diusulkan oleh AI
            </span>
          </div>

          {isBabListOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {teacherBabList.map((babTitle, bIdx) => (
                <div
                  key={`bab-slot-${bIdx}`}
                  className="flex items-center gap-2 bg-slate-50/90 p-2 rounded-xl border border-slate-200"
                >
                  <span className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-[11px] font-bold shrink-0">
                    Bab {bIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={babTitle}
                    placeholder={`e.g. Bab ${bIdx + 1}: Judul Materi...`}
                    onChange={(e) => handleTeacherBabNameChange(bIdx, e.target.value)}
                    className="w-full text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  {targetUnitCount > 1 && (
                    <button
                      type="button"
                      title="Hapus slot Bab ini"
                      onClick={() => handleRemoveBabSlot(bIdx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {targetUnitCount < 15 && (
                <button
                  type="button"
                  onClick={handleAddBabSlot}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Slot Bab ({targetUnitCount + 1})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visual Unit Grouping Overview */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Ringkasan Pengelompokan Unit / Bab ({Object.keys(unitStats.groups).length} Unit Terpetakan)</span>
          </h4>
          <span className="text-[11px] text-slate-500 font-medium">
            Total {items.length} Langkah ATP
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(unitStats.groups).map(([title, count]) => (
            <div
              key={title}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-blue-200/80 shadow-2xs text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="font-bold text-slate-800">{title}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold text-[10px]">
                {count} Langkah
              </span>
            </div>
          ))}

          {unitStats.unassigned > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold">Belum ditentukan Unit/Bab</span>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-200/60 font-bold text-[10px]">
                {unitStats.unassigned} Langkah
              </span>
            </div>
          )}

          {items.length === 0 && (
            <span className="text-xs text-slate-400 italic">Belum ada butir ATP yang disusun.</span>
          )}
        </div>
      </div>

      {/* Datalist for Unit Suggestions */}
      <datalist id="existing-units-list">
        {existingUnitTitles.map((ut) => (
          <option key={ut} value={ut} />
        ))}
      </datalist>

      {/* Editable Mapping Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-700" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Matriks Alur Tujuan Pembelajaran & Pemetaan Unit
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">
            Anda dapat mengubah Unit/Bab dan Lingkup Materi secara manual kapan saja pada baris tabel di bawah.
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Data ATP Masih Kosong</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Silakan kembali ke tahap ATP untuk menyusun butir alur pembelajaran sebelum melakukan pemetaan unit.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const tpItem = item.tpId ? tpMap.get(item.tpId) : undefined;
              const tpCode = item.tpCode || tpItem?.code || `TP-${idx + 1}`;
              const tpStatement = item.tpStatement || tpItem?.statement || '-';

              const prevItem = idx > 0 ? items[idx - 1] : null;
              const isNewGroup = !prevItem || prevItem.unitTitle?.trim() !== item.unitTitle?.trim();

              return (
                <React.Fragment key={item.id || `atp-map-${idx}`}>
                  {/* Visual Unit Break Header when Unit changes */}
                  {isNewGroup && (
                    <div className="bg-slate-100/70 px-4 py-2 border-y border-slate-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          {item.unitTitle?.trim() ? item.unitTitle.trim() : 'Kelompok: (Belum Diberi Unit/Bab)'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Mulai Langkah #{item.stepNumber || idx + 1}
                      </span>
                    </div>
                  )}

                  <div className="p-4 sm:p-5 hover:bg-slate-50/50 transition flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Column 1: Step Number & TP Code */}
                    <div className="w-full lg:w-48 shrink-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-blue-900 text-white font-bold text-xs shadow-2xs">
                          Langkah {item.stepNumber || idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs">
                          {tpCode}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: TP Statement */}
                    <div className="flex-1 space-y-1">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Rumusan Tujuan Pembelajaran (Canonical TP)
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-normal">
                        {tpStatement}
                      </p>
                    </div>

                    {/* Column 3: Editable Unit / Bab */}
                    <div className="w-full lg:w-72 shrink-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase">
                          Unit / Bab Operasional <span className="text-blue-600">*</span>
                        </label>
                        {teacherBabList.some((b) => b.trim().length > 0) && (
                          <select
                            value={item.unitTitle || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleFieldChange(idx, 'unitTitle', e.target.value);
                              }
                            }}
                            className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 cursor-pointer"
                          >
                            <option value="">Pilih Bab...</option>
                            {teacherBabList
                              .filter((b) => b.trim().length > 0)
                              .map((b, bIdx) => (
                                <option key={`opt-bab-${bIdx}`} value={b}>
                                  {b}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                      <input
                        type="text"
                        list="existing-units-list"
                        value={item.unitTitle || ''}
                        placeholder="e.g. Bab 1: Mengenal Bilangan"
                        onChange={(e) => handleFieldChange(idx, 'unitTitle', e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Pilih dari daftar atau ketik bab baru
                      </span>
                    </div>

                    {/* Column 4: Editable Lingkup Materi */}
                    <div className="w-full lg:w-80 shrink-0 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Lingkup Materi Inti
                      </label>
                      <input
                        type="text"
                        value={item.materialScope || ''}
                        placeholder="e.g. Bilangan Cacah sampai 100"
                        onChange={(e) => handleFieldChange(idx, 'materialScope', e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Fokus konten materi untuk asesmen & modul ajar
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          id="btn-back-to-atp"
          type="button"
          onClick={onBackToATP}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Alur Tujuan Pembelajaran (06)</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="btn-next-to-annual-planning"
            type="button"
            onClick={handleProceedNext}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white py-2.5 px-6 rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <span>Lanjut ke Perencanaan Tahunan (08)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
