
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CLASSES, WEEKS, TIMES, SYLLABUS_T4, SYLLABUS_T5, STUDENT_COUNTS, PAK21_ACTIVITIES, REFLECTION_ACTION_SUGGESTIONS, NOTES_OPTIONS 
} from './constants';
import { FormData, SyllabusEntry } from './types';
import { generateRPHContent } from './geminiService';

const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1RrYFTb6yQDzCKXg9DTPwVbnWplI60tvE?lfhs=2";

const App: React.FC = () => {
  const savedSchoolLogo = localStorage.getItem('schoolLogo') || 'https://raw.githubusercontent.com/ai-studio-examples/assets/main/smk_hosba_logo.png';
  const savedTs25Logo = localStorage.getItem('ts25Logo') || 'https://raw.githubusercontent.com/ai-studio-examples/assets/main/ts25_logo.png';

  const [formData, setFormData] = useState<FormData>({
    week: 'Minggu 1',
    form: '4',
    class: CLASSES[0],
    date: new Date().toISOString().split('T')[0],
    day: new Intl.DateTimeFormat('ms-MY', { weekday: 'long' }).format(new Date()),
    studentCount: 20,
    timeStart: '07:20 AM',
    timeEnd: '08:20 AM',
    topic: '',
    sk: [],
    sp: [],
    pak21: [],
    objective: '',
    successCriteria: '',
    activities: '',
    assessment: 'Pemerhatian, Lisan, Lembaran Kerja',
    notes: NOTES_OPTIONS[1],
    otherNotes: '',
    reflection: '',
    presentStudents: 20,
    absentStudents: 0,
    masteredStudents: 20, // Default: Semua yang hadir menguasai
    reflectionAction: REFLECTION_ACTION_SUGGESTIONS[0],
    schoolLogo: savedSchoolLogo,
    ts25Logo: savedTs25Logo,
    isPdpExecuted: true,
    hasCoursework: false,
    courseworkInput: '',
    courseworkOutput: ''
  });

  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [activeSyllabus, setActiveSyllabus] = useState<SyllabusEntry[]>(SYLLABUS_T4);
  const schoolLogoRef = useRef<HTMLInputElement>(null);
  const ts25LogoRef = useRef<HTMLInputElement>(null);

  // Auto-kira murid belum menguasai
  const guidanceCount = useMemo(() => {
    return Math.max(0, formData.presentStudents - formData.masteredStudents);
  }, [formData.presentStudents, formData.masteredStudents]);

  const autoReflectionText = useMemo(() => {
    if (!formData.isPdpExecuted) {
      return `PdPc tidak dapat dilaksanakan kerana: ${formData.notes}. PdPc akan dibawa ke sesi akan datang.`;
    }
    const { presentStudents, studentCount, masteredStudents } = formData;
    if (studentCount === 0) return '';
    
    let text = `Seramai ${presentStudents}/${studentCount} orang murid telah hadir. `;
    text += `${masteredStudents} orang murid telah mencapai objektif pembelajaran hari ini. `;
    
    if (guidanceCount > 0) {
      text += `${guidanceCount} orang murid belum menguasai dan diberikan bimbingan tambahan.`;
    } else if (presentStudents > 0) {
      text += `Semua murid yang hadir berjaya menguasai standard pembelajaran yang ditetapkan.`;
    }
    return text;
  }, [formData.presentStudents, formData.studentCount, formData.masteredStudents, formData.isPdpExecuted, formData.notes, guidanceCount]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, reflection: autoReflectionText }));
  }, [autoReflectionText]);

  useEffect(() => {
    const dateObj = new Date(formData.date);
    const day = new Intl.DateTimeFormat('ms-MY', { weekday: 'long' }).format(dateObj);
    setFormData(prev => ({ ...prev, day }));
  }, [formData.date]);

  useEffect(() => {
    setActiveSyllabus(formData.form === '4' ? SYLLABUS_T4 : SYLLABUS_T5);
    setFormData(prev => ({ ...prev, topic: '', sk: [], sp: [] }));
  }, [formData.form]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'school' | 'ts25') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, [type === 'school' ? 'schoolLogo' : 'ts25Logo']: base64 }));
        localStorage.setItem(type === 'school' ? 'schoolLogo' : 'ts25Logo', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAI = async () => {
    if (!formData.topic || formData.sk.length === 0 || formData.sp.length === 0) {
      alert("Sila pilih Tajuk, SK dan SP terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      const result = await generateRPHContent(
        formData.topic, 
        formData.sk, 
        formData.sp, 
        formData.pak21,
        formData.hasCoursework,
        formData.courseworkInput
      );
      setFormData(prev => ({
        ...prev,
        objective: result.objective,
        successCriteria: result.successCriteria,
        activities: result.activities,
        assessment: result.assessment,
        courseworkOutput: result.courseworkOutput || '',
      }));
    } catch (error) {
      console.error(error);
      alert("Gagal menjana kandungan. Sila cuba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (openDrive = false) => {
    if (!formData.activities) {
      alert("Sila jana kandungan eRPH terlebih dahulu sebelum memuat turun.");
      return;
    }

    setPdfGenerating(true);
    const element = document.getElementById('rph-pdf-capture-area');
    if (!element) {
      setPdfGenerating(false);
      return;
    }

    const images = Array.from(element.getElementsByTagName('img'));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const opt = {
      margin: 0,
      filename: `eRPH_AK_${formData.class}_${formData.date}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 4, 
        useCORS: true, 
        letterRendering: true, 
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: 0,
        scrollX: 0,
        width: 794, 
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait', 
        compress: true,
        precision: 16 
      },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    try {
      // @ts-ignore
      await window.html2pdf().from(element).set(opt).save();
      
      if (openDrive) {
        window.open(DRIVE_FOLDER_URL, '_blank');
        alert("Fail telah dimuat turun. Sila seret fail tersebut ke tab Google Drive yang baru dibuka untuk simpanan auto.");
      }
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Masalah teknikal semasa menjana PDF. Sila cuba lagi.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const toggleSelection = (field: 'sk' | 'sp' | 'pak21', value: string) => {
    setFormData(prev => {
      const current = prev[field] as string[];
      if (current.includes(value)) return { ...prev, [field]: current.filter(v => v !== value) };
      const limit = field === 'sk' ? 3 : field === 'pak21' ? 3 : 999;
      if (current.length < limit) return { ...prev, [field]: [...current, value] };
      return prev;
    });
  };

  const renderSectionHeader = (title: string) => (
    <div className="pdf-section-header bg-yellow-400 border-y-2 border-black px-3 py-1 mt-4 mb-2">
      <h2 className="text-[14pt] font-bold uppercase arial-font text-black leading-normal">{title}</h2>
    </div>
  );

  const renderStrictLines = (text: string) => {
    if (!text) return null;
    let stepCounter = 0;
    return text.split('\n').filter(line => line.trim()).map((line, idx) => {
      const trimmed = line.trim();
      const isHeader = trimmed.includes('Set Induksi:') || trimmed.includes('Aktiviti Utama:') || trimmed.includes('Penutup:');
      
      if (isHeader) {
        stepCounter = 0; 
        return (
          <div key={idx} className="font-bold mt-4 underline leading-relaxed arial-font text-[11pt] pdf-text">
            {trimmed}
          </div>
        );
      } else {
        stepCounter++;
        const cleanLine = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '');
        return (
          <div key={idx} className="mb-1 ml-6 leading-relaxed arial-font text-[11pt] text-justify flex gap-3 pdf-text items-start">
            <span className="font-bold min-w-[20px]">{stepCounter}.</span>
            <span className="flex-1">{cleanLine}</span>
          </div>
        );
      }
    });
  };

  const renderCombinedObjectives = (source: string, sourceCrit: string) => {
    const objLines = source.split('\n').map(l => l.replace(/^[0-9.]+\s*/, '').trim()).filter(l => l);
    const critLines = sourceCrit.split('\n').map(l => l.replace(/^[0-9.]+\s*/, '').trim()).filter(l => l);
    const allLines = [...objLines, ...critLines];

    if (allLines.length === 0) return <p className="italic text-zinc-400">Tiada kandungan.</p>;

    return (
      <div className="space-y-2 ml-4">
        {allLines.map((line, idx) => (
          <div key={idx} className="flex gap-3 leading-relaxed arial-font text-[11pt] text-justify items-start pdf-text">
            <span className="font-bold min-w-[20px]">{idx + 1}.</span>
            <span className="flex-1">{line}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center py-8 px-4 arial-font no-print-bg">
      {/* UI UTAMA */}
      <div className="max-w-5xl w-full bg-white shadow-xl rounded-3xl p-6 mb-8 no-print border-t-[10px] border-zinc-900">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-800 tracking-tight uppercase">eRPH PINTAR v2026</h1>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Asas Kelestarian Tingkatan 4 & 5</p>
          </div>
          <div className="flex gap-4">
             <div className="flex flex-col items-center">
                <button onClick={() => schoolLogoRef.current?.click()} className="p-1 border-2 border-zinc-100 rounded-xl h-12 w-12 bg-zinc-50 flex items-center justify-center overflow-hidden hover:border-yellow-400 transition-all">
                    <img src={formData.schoolLogo} className="max-h-full object-contain" alt="Logo Sekolah" />
                </button>
                <span className="text-[7px] font-black text-zinc-500 mt-1 uppercase">Logo Kiri</span>
             </div>
             <div className="flex flex-col items-center">
                <button onClick={() => ts25LogoRef.current?.click()} className="p-1 border-2 border-zinc-100 rounded-xl h-12 w-12 bg-zinc-50 flex items-center justify-center overflow-hidden hover:border-yellow-400 transition-all">
                    <img src={formData.ts25Logo} className="max-h-full object-contain" alt="Logo TS25" />
                </button>
                <span className="text-[7px] font-black text-zinc-500 mt-1 uppercase">Logo Kanan</span>
             </div>
             <input type="file" ref={schoolLogoRef} className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'school')} />
             <input type="file" ref={ts25LogoRef} className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'ts25')} />
          </div>
        </div>

        {/* STATUS PELAKSANAAN PdP */}
        <div className="mb-6 p-5 bg-zinc-50 rounded-2xl border-2 border-zinc-200">
           <label className="text-sm font-black text-zinc-800 uppercase mb-4 block tracking-wide">Status Pelaksanaan PdPc</label>
           <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <button 
                  onClick={() => setFormData(p => ({ ...p, isPdpExecuted: true, presentStudents: p.studentCount, masteredStudents: p.studentCount }))}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${formData.isPdpExecuted ? 'bg-zinc-900 text-white border-zinc-900 shadow-xl scale-[1.02]' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                >
                  {formData.isPdpExecuted && <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse"></div>}
                  Dilaksanakan
                </button>
                <button 
                  onClick={() => setFormData(p => ({ ...p, isPdpExecuted: false, presentStudents: 0, masteredStudents: 0 }))}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${!formData.isPdpExecuted ? 'bg-red-600 text-white border-red-700 shadow-xl scale-[1.02]' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                >
                  {!formData.isPdpExecuted && <div className="h-3 w-3 bg-white rounded-full animate-pulse"></div>}
                  Ditangguhkan
                </button>
              </div>

              {!formData.isPdpExecuted && (
                <div className="flex-1 animate-in slide-in-from-right duration-300">
                   <p className="text-[10px] font-bold text-red-600 uppercase mb-1 ml-1">Sebab PdPc tidak dilaksanakan:</p>
                   <select 
                     className="w-full border-2 p-3.5 rounded-2xl font-black bg-white border-red-200 focus:border-red-500 outline-none text-red-900 text-sm shadow-inner" 
                     value={formData.notes} 
                     onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                   >
                     {NOTES_OPTIONS.filter(opt => opt !== 'PdP dilaksanakan mengikut rancangan').map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                </div>
              )}
           </div>
        </div>

        {/* INPUT ASAS & KEHADIRAN */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Minggu</label>
            <select className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.week} onChange={e => setFormData(p => ({ ...p, week: e.target.value }))}>
              {WEEKS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Tarikh</label>
            <input type="date" className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Bil. Hadir</label>
            <input 
              type="number" 
              className={`w-full border p-2 rounded text-sm font-bold bg-white ${!formData.isPdpExecuted ? 'bg-zinc-100 opacity-50' : ''}`}
              value={formData.presentStudents}
              disabled={!formData.isPdpExecuted}
              onChange={e => {
                const val = Math.min(parseInt(e.target.value) || 0, formData.studentCount);
                setFormData(p => ({ ...p, presentStudents: val, masteredStudents: Math.min(p.masteredStudents, val) }));
              }} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Bil. Keseluruhan</label>
            <select className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.studentCount} onChange={e => {
                const val = parseInt(e.target.value);
                setFormData(p => ({ ...p, studentCount: val, presentStudents: Math.min(p.presentStudents, val), masteredStudents: Math.min(p.masteredStudents, val) }));
            }}>
              {STUDENT_COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Tingkatan</label>
            <select className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.form} onChange={e => setFormData(p => ({ ...p, form: e.target.value as '4'|'5' }))}>
              <option value="4">Tingkatan 4</option>
              <option value="5">Tingkatan 5</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Kelas</label>
            <select className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.class} onChange={e => setFormData(p => ({ ...p, class: e.target.value }))}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Masa Mula</label>
            <select className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.timeStart} onChange={e => setFormData(p => ({ ...p, timeStart: e.target.value }))}>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Masa Tamat</label>
            <select className="w-full border p-2 rounded text-sm font-bold bg-white" value={formData.timeEnd} onChange={e => setFormData(p => ({ ...p, timeEnd: e.target.value }))}>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* PEMILIHAN TAJUK & PAK21 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Tajuk DSKP</label>
            <select className="w-full border-2 p-2 rounded-xl font-bold bg-white border-zinc-200 focus:border-yellow-400 outline-none text-sm" value={formData.topic} onChange={e => setFormData(p => ({ ...p, topic: e.target.value, sk: [], sp: [] }))}>
              <option value="">-- SILA PILIH TAJUK --</option>
              {activeSyllabus.map(s => <option key={s.topic} value={s.topic}>{s.topic}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">PAK21 Utama</label>
            <select className="w-full border-2 p-2 rounded-xl font-bold bg-white border-zinc-200 focus:border-yellow-400 outline-none text-sm" onChange={e => toggleSelection('pak21', e.target.value)}>
              <option value="">-- Pilih --</option>
              {PAK21_ACTIVITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {formData.topic && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-in fade-in duration-300">
            <div className="bg-zinc-50 p-3 rounded-xl border-2 border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 mb-2 uppercase">SK (Standard Kandungan)</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {activeSyllabus.find(s => s.topic === formData.topic)?.sk.map(sk => (
                  <div key={sk} onClick={() => toggleSelection('sk', sk)} className={`p-2 text-[10px] rounded-lg border-2 cursor-pointer transition-all ${formData.sk.includes(sk) ? 'bg-yellow-400 border-yellow-500 font-bold' : 'bg-white hover:bg-zinc-100 border-zinc-100'}`}>{sk}</div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-50 p-3 rounded-xl border-2 border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 mb-2 uppercase">SP (Standard Pembelajaran)</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {formData.sk.flatMap(sk => activeSyllabus.find(s => s.topic === formData.topic)?.sp[sk] || []).map(sp => (
                  <div key={sp} onClick={() => toggleSelection('sp', sp)} className={`p-2 text-[10px] rounded-lg border-2 cursor-pointer transition-all ${formData.sp.includes(sp) ? 'bg-zinc-800 text-white border-zinc-900 font-bold' : 'bg-white hover:bg-zinc-100 border-zinc-100'}`}>{sp}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STATUS AMALI KERJA KURSUS */}
        <div className="mb-6 p-5 bg-zinc-50 rounded-2xl border-2 border-zinc-200">
           <label className="text-sm font-black text-zinc-850 uppercase mb-2 block tracking-wide">Pelibatan Amali Kerja Kursus</label>
           <p className="text-xs text-zinc-500 mb-4 font-bold uppercase tracking-wider">Adakah murid menjalankan amali kerja kursus dalam sesi ini?</p>
           <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, hasCoursework: true }))}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${formData.hasCoursework ? 'bg-zinc-900 text-white border-zinc-900 shadow-xl scale-[1.02]' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                >
                  {formData.hasCoursework && <div className="h-3 w-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                  Ya, Terlibat
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, hasCoursework: false, courseworkOutput: '' }))}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${!formData.hasCoursework ? 'bg-zinc-700 text-white border-zinc-700 shadow-xl scale-[1.02]' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                >
                  {!formData.hasCoursework && <div className="h-3 w-3 bg-white rounded-full animate-pulse"></div>}
                  Tidak Terlibat
                </button>
              </div>

              {formData.hasCoursework && (
                <div className="flex-1 animate-in slide-in-from-right duration-300">
                   <p className="text-[10px] font-bold text-zinc-600 uppercase mb-1 ml-1">Fokus / Aktiviti Amali Kerja Kursus (Draf Guru):</p>
                   <textarea 
                     className="w-full border-2 p-3 rounded-2xl font-semibold bg-white border-zinc-200 focus:border-yellow-400 outline-none text-zinc-800 text-sm shadow-inner resize-none h-[4.5rem]" 
                     placeholder="Taipkan rupa bentuk amali atau tugasan spesifik draf untuk dijana..."
                     value={formData.courseworkInput} 
                     onChange={e => setFormData(p => ({ ...p, courseworkInput: e.target.value }))}
                   />
                </div>
              )}
           </div>
        </div>

        {/* JANA AI */}
        <div className="mb-8">
           <button onClick={handleGenerateAI} disabled={loading} className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-tighter flex items-center justify-center gap-3">
             {loading ? (
               <>
                 <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></span>
                 SEDANG MENJANA KANDUNGAN...
               </>
             ) : '✨ JANA KANDUNGAN eRPH (AI)'}
           </button>
        </div>

        {/* PRATONTON EDITABLE */}
        { (formData.activities || formData.objective) && (
          <div className="space-y-6 mb-8 p-6 bg-zinc-50 rounded-3xl border-2 border-zinc-900 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-xl font-black text-zinc-900 uppercase border-b-4 border-yellow-400 inline-block mb-4">PRATONTON & KEMAS KINI</h3>
            
            {/* STATISTIK MURID (EDITABLE) */}
            <div className="p-4 bg-white rounded-2xl border-2 border-zinc-200 mb-6">
                <p className="text-[11px] font-bold text-zinc-500 uppercase mb-3">Statistik Pencapaian Murid</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Bil. Murid Kuasai</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border-2 rounded-xl font-bold bg-zinc-50"
                        value={formData.masteredStudents}
                        onChange={e => {
                          const val = Math.min(parseInt(e.target.value) || 0, formData.presentStudents);
                          setFormData(p => ({ ...p, masteredStudents: val }));
                        }}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Bil. Belum Kuasai (Auto)</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border-2 rounded-xl font-bold bg-zinc-200 cursor-not-allowed"
                        value={guidanceCount}
                        readOnly
                      />
                   </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-zinc-600 uppercase">Objektif Pembelajaran</label>
                 <textarea className="w-full h-32 p-4 rounded-xl border-2 border-zinc-200 focus:border-yellow-400 outline-none text-sm" value={formData.objective} onChange={e => setFormData(p => ({ ...p, objective: e.target.value }))}></textarea>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-zinc-600 uppercase">Kriteria Kejayaan</label>
                 <textarea className="w-full h-32 p-4 rounded-xl border-2 border-zinc-200 focus:border-yellow-400 outline-none text-sm" value={formData.successCriteria} onChange={e => setFormData(p => ({ ...p, successCriteria: e.target.value }))}></textarea>
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase">Aktiviti PdPc</label>
              <textarea className="w-full h-64 p-4 rounded-xl border-2 border-zinc-200 focus:border-yellow-400 outline-none text-sm leading-relaxed" value={formData.activities} onChange={e => setFormData(p => ({ ...p, activities: e.target.value }))}></textarea>
            </div>

            {formData.hasCoursework && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <label className="text-[10px] font-bold text-zinc-600 uppercase">Cadangan Aktiviti Tambahan (Amali Kerja Kursus)</label>
                <textarea 
                  className="w-full h-32 p-4 rounded-xl border-2 border-zinc-200 focus:border-yellow-400 outline-none text-sm leading-relaxed" 
                  placeholder="Tiada aktiviti ditaip atau dijana. Sila taip di sini atau tekan butang Jana untuk menjana daripada AI..."
                  value={formData.courseworkOutput} 
                  onChange={e => setFormData(p => ({ ...p, courseworkOutput: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-600 uppercase">Pentaksiran</label>
                <input className="w-full p-4 rounded-xl border-2 border-zinc-200 focus:border-yellow-400 outline-none text-sm" value={formData.assessment} onChange={e => setFormData(p => ({ ...p, assessment: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-600 uppercase">Refleksi</label>
                <textarea className="w-full h-24 p-4 rounded-xl border-2 border-zinc-200 focus:border-yellow-400 outline-none text-sm" value={formData.reflection} onChange={e => setFormData(p => ({ ...p, reflection: e.target.value }))}></textarea>
              </div>
            </div>
          </div>
        )}

        {/* MUAT TURUN & DRIVE BUTTONS */}
        <div className="mt-8 flex flex-col md:flex-row gap-4">
          <button 
            onClick={() => downloadPDF(false)} 
            disabled={pdfGenerating} 
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-lg disabled:opacity-50"
          >
            {pdfGenerating ? 'MENYEDIAKAN PDF...' : '📄 MUAT TURUN PDF'}
          </button>
          
          <button 
            onClick={() => downloadPDF(true)} 
            disabled={pdfGenerating} 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-lg disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {pdfGenerating ? 'SEDANG DIPROSES...' : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5,2L20.42,15.74L17.5,20.82L4.5,20.82L1.58,15.74L9.5,2H12.5M12.5,4H9.5L3.31,14.74L6.23,19.82H17.77L20.69,14.74L14.5,4H12.5M12,10.5C11.17,10.5 10.5,11.17 10.5,12C10.5,12.83 11.17,13.5 12,13.5C12.83,13.5 13.5,12.83 13.5,12C13.5,11.17 12.83,10.5 12,10.5Z" />
                </svg>
                SIMPAN KE GOOGLE DRIVE
              </>
            )}
          </button>
        </div>
      </div>

      {/* ==========================================================
          KAWASAN CAPTURE PDF
         ========================================================== */}
      <div id="pdf-wrapper-fixed" className="pdf-hidden">
        <div id="rph-pdf-capture-area" className="bg-white">
          <div className="page-a4 bg-white text-black relative">
            <div className="header-container pdf-section">
               <div className="logo-wrapper logo-left-fixed">
                  <img src={formData.schoolLogo} alt="Logo Sekolah" className="header-logo-compact" />
               </div>
               <div className="title-wrapper-centered">
                  <h1 className="text-[14pt] font-bold uppercase arial-font leading-tight">RANCANGAN PENGAJARAN HARIAN (eRPH)</h1>
                  <p className="text-[12pt] font-bold uppercase mt-1">MATA PELAJARAN: ASAS KELESTARIAN</p>
               </div>
               <div className="logo-wrapper logo-right-fixed">
                  <img src={formData.ts25Logo} alt="Logo TS25" className="header-logo-compact" />
               </div>
            </div>

            <div className="border-2 border-black w-full mb-6 arial-font text-[11pt] pdf-section pdf-table-wrapper">
               <div className="grid grid-cols-[1.5fr_2.5fr_1.5fr_2.5fr] border-b-2 border-black">
                  <div className="p-3 font-bold bg-zinc-50 border-r-2 border-black uppercase pdf-text">MINGGU</div>
                  <div className="p-3 border-r-2 border-black font-bold uppercase pdf-text">{formData.week}</div>
                  <div className="p-3 font-bold bg-zinc-50 border-r-2 border-black uppercase pdf-text">HARI</div>
                  <div className="p-3 font-bold uppercase pdf-text">{formData.day}</div>
               </div>
               <div className="grid grid-cols-[1.5fr_2.5fr_1.5fr_2.5fr] border-b-2 border-black">
                  <div className="p-3 font-bold bg-zinc-50 border-r-2 border-black uppercase pdf-text">TARIKH</div>
                  <div className="p-3 border-r-2 border-black font-bold pdf-text">{new Date(formData.date).toLocaleDateString('en-GB')}</div>
                  <div className="p-3 font-bold bg-zinc-50 border-r-2 border-black uppercase pdf-text">MASA</div>
                  <div className="p-3 font-bold uppercase pdf-text">{formData.timeStart} - {formData.timeEnd}</div>
               </div>
               <div className="grid grid-cols-[1.5fr_2.5fr_1.5fr_2.5fr]">
                  <div className="p-3 font-bold bg-zinc-50 border-r-2 border-black uppercase pdf-text">KELAS</div>
                  <div className="p-3 border-r-2 border-black font-bold uppercase pdf-text">{formData.class}</div>
                  <div className="p-3 font-bold bg-zinc-50 border-r-2 border-black uppercase pdf-text">KEHADIRAN</div>
                  <div className="p-3 font-bold pdf-text">{formData.presentStudents} / {formData.studentCount} Orang</div>
               </div>
            </div>

            <div className="pdf-section">
              {renderSectionHeader("1.0 Tajuk / Tema")}
              <div className="mb-4 px-2 ml-4 arial-font text-[11pt] font-bold uppercase leading-relaxed pdf-text">
                 {formData.topic || "-"}
              </div>
            </div>

            <div className="pdf-section">
              {renderSectionHeader("2.0 Standard Kandungan (SK)")}
              <div className="mb-4 px-2 ml-4 space-y-2 arial-font text-[11pt] pdf-text">
                 {formData.sk.length > 0 ? formData.sk.map((line, idx) => (
                    <div key={idx} className="leading-relaxed text-justify">• {line}</div>
                 )) : <div className="italic text-zinc-400">-</div>}
              </div>
            </div>

            <div className="pdf-section">
              {renderSectionHeader("3.0 Standard Pembelajaran (SP)")}
              <div className="mb-4 px-2 ml-4 space-y-2 arial-font text-[11pt] pdf-text">
                 {formData.sp.length > 0 ? formData.sp.map((line, idx) => (
                    <div key={idx} className="leading-relaxed text-justify">• {line}</div>
                 )) : <div className="italic text-zinc-400">-</div>}
              </div>
            </div>

            <div className="pdf-section">
              {renderSectionHeader("4.0 Objektif Pembelajaran & Kriteria Kejayaan")}
              <div className="px-2 mb-4">
                 {renderCombinedObjectives(formData.objective, formData.successCriteria)}
              </div>
            </div>
            
            <div className="absolute bottom-6 left-0 right-0 text-center text-[8pt] text-zinc-400 italic">
               Muka Surat 1/2
            </div>
          </div>

          <div className="page-a4 bg-white text-black relative">
            <div className="pdf-section">
              {renderSectionHeader("5.0 Aktiviti Pengajaran & Pembelajaran")}
              <div className="px-2 mb-8">
                 {renderStrictLines(formData.activities) || <p className="italic text-zinc-400 ml-4">Tiada aktiviti dijana...</p>}
                 <div className="mt-8 pt-3 border-t-2 border-black arial-font text-[10pt] italic pdf-text">
                    PAK21: {formData.pak21.length > 0 ? formData.pak21.join(', ') : '-'} | Pentaksiran: {formData.assessment}
                 </div>
              </div>
            </div>

            {formData.hasCoursework && (
              <div className="pdf-section mt-4 mb-4">
                {renderSectionHeader("5.1 Cadangan Aktiviti Tambahan (Amali Kerja Kursus)")}
                <div className="px-2 mb-2">
                  {formData.courseworkInput && (
                    <div className="mb-2 text-[10.5pt] font-semibold text-zinc-800 italic pdf-text">
                      Fokus Amali Kerja Kursus: {formData.courseworkInput}
                    </div>
                  )}
                  {renderStrictLines(formData.courseworkOutput) || (
                    <p className="italic text-zinc-400 ml-4 leading-relaxed pdf-text">Tiada aktiviti tambahan amali dijana...</p>
                  )}
                </div>
              </div>
            )}

            <div className="pdf-section mt-10">
              {renderSectionHeader("6.0 Refleksi & Catatan Guru")}
              <div className={`border-2 border-black p-5 arial-font text-[11pt] ${formData.isPdpExecuted ? 'bg-zinc-50' : 'bg-red-50 border-red-900'} pdf-ref-box`}>
                 <div className="mb-5 italic leading-relaxed text-justify font-bold underline pdf-text">
                    {formData.reflection}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-6 mb-5 font-bold border-b-2 border-black border-dotted pb-4 pdf-text">
                    <div className="flex flex-col gap-1">
                       <p className="text-[10pt] uppercase">Murid Menguasai:</p>
                       <span className="text-2xl">{formData.masteredStudents} / {formData.presentStudents}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                       <p className="text-[10pt] uppercase">Murid Bimbingan:</p>
                       <span className="text-2xl">{guidanceCount}</span>
                    </div>
                 </div>

                 <div className="mt-4">
                    <p className={`font-bold underline mb-2 uppercase text-[10pt] pdf-text ${!formData.isPdpExecuted ? 'text-red-900' : ''}`}>
                      {formData.isPdpExecuted ? 'Tindakan Susulan / Cadangan:' : 'Catatan Penangguhan PdPc:'}
                    </p>
                    <p className="mb-2 leading-relaxed pdf-text">
                       {formData.isPdpExecuted ? formData.reflectionAction : `Sebab Penangguhan: ${formData.notes}`}
                    </p>
                 </div>
              </div>
            </div>

            <div className="mt-32 flex justify-start px-3 arial-font pdf-section">
               <div className="text-center w-[250px]">
                  <p className="mb-20 italic text-[11pt] pdf-text">Disediakan Oleh,</p>
                  <div className="border-t-2 border-black w-full mb-2"></div>
                  <p className="font-bold text-[11pt] uppercase tracking-tight pdf-text">NOOR SHAMSILA BINTI ISMAIL</p>
                  <p className="text-[10pt] italic pdf-text">Guru Mata Pelajaran</p>
               </div>
            </div>

            <div className="absolute bottom-6 left-0 right-0 text-center text-[8pt] text-zinc-400 italic">
               Muka Surat 2/2 | eRPH Pintar v2026
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .arial-font { font-family: 'Arial', sans-serif; }
        .pdf-hidden {
          position: fixed;
          top: 0;
          left: -10000px;
          width: 210mm;
          opacity: 1;
          pointer-events: none;
          z-index: -9999;
          overflow: visible;
        }
        #rph-pdf-capture-area {
          width: 210mm;
          background-color: white;
          color: black;
        }
        .page-a4 {
          width: 210mm;
          min-height: 296.8mm;
          padding-top: 15mm;
          padding-bottom: 20mm;
          padding-left: 25mm;
          padding-right: 15mm;
          box-sizing: border-box;
          background-color: white;
          overflow: hidden;
          page-break-after: always;
          position: relative;
        }
        .header-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 25mm;
          border-bottom: 3.5px solid black;
          margin-bottom: 8mm;
          padding-bottom: 4mm;
        }
        .logo-wrapper {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          height: 100%;
        }
        .logo-left-fixed { left: 0; }
        .logo-right-fixed { right: 0; }
        .header-logo-compact {
          max-height: 22mm;
          max-width: 38mm;
          object-fit: contain;
        }
        .title-wrapper-centered {
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 45mm;
        }
        .pdf-section {
          display: block;
          width: 100%;
          break-inside: avoid;
          position: relative;
        }
        .pdf-text {
          color: black !important;
          z-index: 10;
          position: relative;
        }
        .pdf-section-header {
          z-index: 5;
          position: relative;
          border-width: 2px !important;
        }
        .pdf-table-wrapper {
          border-width: 2px !important;
          border-collapse: collapse;
        }
        .pdf-ref-box {
          border-width: 2px !important;
          box-shadow: none !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #eee; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
