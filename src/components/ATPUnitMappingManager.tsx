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
} from 'lucide-react';
import { ATPData, ATPItem, TPData } from '../types';

export interface ATPUnitMappingManagerProps {
  atp: ATPData;
  tp: TPData;
  onSaveATP: (updatedAtp: ATPData) => void;
  onNextStep: () => void;
  onBackToATP: () => void;
}

export const ATPUnitMappingManager: React.FC<ATPUnitMappingManagerProps> = ({
  atp,
  tp,
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

  // Sync state if atp.items updates from outside
  useEffect(() => {
    setItems(
      [...(atp.items || [])].sort(
        (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
      )
    );
    setHasChanges(false);
  }, [atp.items]);

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
    items.forEach((it) => {
      if (it.unitTitle && it.unitTitle.trim().length > 0) {
        titles.add(it.unitTitle.trim());
      }
    });
    return Array.from(titles);
  }, [items]);

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
              Petakan alur tujuan pembelajaran (ATP) yang telah disusun ke dalam <strong>Unit / Bab operasional</strong> dan tentukan fokus <strong>Lingkup Materi Inti</strong>. Struktur ini menjadi dasar langsung dokumen resmi <em>Pemetaan ATP, Unit/Bab, dan Lingkup Materi</em> serta distribusi ke semester.
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

      {/* Visual Unit Grouping Overview */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Ringkasan Pengelompokan Unit / Bab ({Object.keys(unitStats.groups).length} Unit Terdaftar)</span>
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
            Ketik nama Unit/Bab yang sama pada beberapa baris untuk mengelompokkannya ke dalam bab yang sama.
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
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Unit / Bab Operasional <span className="text-blue-600">*</span>
                      </label>
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
            id="btn-next-to-semester"
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
