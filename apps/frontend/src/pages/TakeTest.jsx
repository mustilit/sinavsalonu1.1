import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { entities } from "@/api/dalClient";
import api from "@/lib/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Grid3x3,
  Trash2,
  Pencil,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReportQuestionModal from "@/components/test/ReportQuestionModal";
import StarRating from "@/components/ui/StarRating";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildPageUrl, useAppNavigate, useLoginRedirect } from "@/lib/navigation";
import { useServiceStatus } from "@/lib/useServiceStatus";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useShouldShowTour, useCompleteTour, TOUR_KEYS } from "@/lib/useOnboarding";
import { CANDIDATE_TEST_STEPS } from "@/components/onboarding/tourSteps";
// Offline koruma: bağlantı koptuğunda otomatik kaydet ve çık
import { useOffline } from "@/lib/useOffline";
// Cevap kuyruğu: offline iken cevapları localStorage'da beklet
import { useAnswerQueue } from "@/lib/useAnswerQueue";
// Offline overlay bileşeni
import OfflineBanner from "@/components/ui/OfflineBanner";
import QuestionCanvas from "@/components/test/QuestionCanvas";

// Map Dal question/options to Sınav Salonu format
function toUIStyle(questions, stateQuestions) {
  const stateMap = new Map((stateQuestions || []).map((q) => [q.id, q]));
  const letters = ["A", "B", "C", "D", "E"];
  return (questions || []).map((q) => {
    const state = stateMap.get(q.id);
    const options = (q.options || []).map((o) => ({
      ...o,
      isCorrect: o.isCorrect ?? o.is_correct,
    }));
    const correctOpt = options.find((o) => o.isCorrect);
    const correctLetter = correctOpt ? letters[options.indexOf(correctOpt)] : "A";
    const optMap = {};
    letters.forEach((l, i) => {
      if (options[i]) {
        optMap[`option_${l.toLowerCase()}`] = options[i].content;
      }
    });
    const selectedOptionId = state?.selectedOptionId;
    const selectedLetter = selectedOptionId
      ? letters[options.findIndex((o) => o.id === selectedOptionId)]
      : null;
    return {
      id: q.id,
      test_id: q.testId,
      question_text: q.content,
      correct_answer: correctLetter,
      ...optMap,
      options,
      selectedOptionId,
      selected_answer: selectedLetter,
      explanation: q.solutionText || null,
      solutionMediaUrl: q.solutionMediaUrl || null,
    };
  });
}

export default function TakeTest() {
  const urlParams = new URLSearchParams(window.location.search);
  const testId = urlParams.get("id");
  const attemptIdParam = urlParams.get("attemptId");
  const isReviewMode = urlParams.get("review") === "true";

  const { user } = useAuth();
  const navigate = useAppNavigate();
  const loginUrl = useLoginRedirect();
  const showTestTour = useShouldShowTour(TOUR_KEYS.CANDIDATE_TEST);
  const completeTour = useCompleteTour();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [testFinished, setTestFinished] = useState(false);
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [activeAttemptId, setActiveAttemptId] = useState(attemptIdParam);
  const [testRating, setTestRating] = useState(0);
  const [educatorRating, setEducatorRating] = useState(0);
  const [testComment, setTestComment] = useState("");
  const [educatorComment, setEducatorComment] = useState("");
  // Süre aşımı modu: timer sıfıra geldiğinde true, test hâlâ çözülebilir
  const [isOvertime, setIsOvertime] = useState(false);
  // Süre aşımı sayacı (saniye cinsinden, timer'ın üstüne eklenir)
  const [overtimeElapsed, setOvertimeElapsed] = useState(0);
  // Süresiz test için geçen süre (saniye) — localStorage ile persist edilir
  const [elapsedSec, setElapsedSec] = useState(0);
  // Çizim modu
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [hasDrawings, setHasDrawings] = useState(false);
  const canvasRef = useRef(null);

  // Soru değişince çizim modunu kapat (canvas kendi çizgilerini zaten sıfırlar)
  useEffect(() => {
    setIsDrawingMode(false);
    setHasDrawings(false);
  }, [currentIndex]);

  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["purchases", user?.id, testId],
    queryFn: () => entities.Purchase.filter({ test_package_id: testId }),
    enabled: !!user && !!testId,
  });

  const purchase = purchases[0];
  const attemptFromPurchase = purchase?.attempt;
  const resolvedAttemptId = activeAttemptId || attemptFromPurchase?.id;

  useEffect(() => {
    if (attemptFromPurchase?.id && !activeAttemptId) {
      setActiveAttemptId(attemptFromPurchase.id);
    }
  }, [attemptFromPurchase?.id, activeAttemptId]);

  const { data: attemptState } = useQuery({
    queryKey: ["attemptState", resolvedAttemptId],
    queryFn: () => entities.Attempt.getState(resolvedAttemptId),
    enabled: !!resolvedAttemptId && !!user,
  });

  // Test meta verisini her zaman yükle (pre-start ekranı + attempt başlatma için)
  const { data: testDetail } = useQuery({
    queryKey: ["testDetail", testId],
    queryFn: async () => {
      const { data } = await api.get(`/tests/${testId}`);
      return data;
    },
    enabled: !!testId,
  });

  // Erişim belirlendi mi? — /me/purchases zaten hem testId hem packageId ile eşleşiyor
  const accessDetermined = !!testDetail && !loadingPurchases;
  const hasAccess = purchases.length > 0;

  // useMemo: questions her render'da yeni referans almasın (useEffect döngüsünü kırar)
  const questions = useMemo(
    () => attemptState && testDetail
      ? toUIStyle(testDetail.questions || [], attemptState.questions)
      : [],
    [attemptState, testDetail]
  );
  const isLoading = !!resolvedAttemptId && !!user && !attemptState;

  const test = testDetail
    ? {
        id: testDetail.id,
        title: testDetail.title,
        is_timed: testDetail.isTimed,
        duration_minutes: testDetail.duration,
        has_solutions: testDetail.hasSolutions,
      }
    : null;

  const testPackage = testDetail
    ? {
        id: testDetail.id,
        title: testDetail.title,
        educator_email: testDetail.educatorId,
        educator_name: testDetail.educator?.username || "",
      }
    : null;

  const previousResult = attemptState?.attempt?.status === "SUBMITTED" || attemptState?.attempt?.status === "TIMEOUT"
    ? attemptState
    : null;

  const { data: resultData } = useQuery({
    queryKey: ["attemptResult", resolvedAttemptId],
    queryFn: () => entities.Attempt.getResult(resolvedAttemptId),
    enabled: !!resolvedAttemptId && !!user && testFinished,
  });

  const { data: allResults = [] } = useQuery({
    queryKey: ["testAverages", testId],
    queryFn: () => entities.TestResult.filter({ user_email: user?.email, test_package_id: testId }),
    enabled: !!testId && !!user && testFinished,
  });

  const { data: existingTestReview } = useQuery({
    queryKey: ["testReview", testId, user?.id],
    queryFn: async () => {
      const reviews = await entities.Review.filter({
        test_package_id: testId,
        reviewer_email: user.email,
        review_type: "test",
      });
      return reviews[0] || null;
    },
    enabled: !!user?.email && !!testId && testFinished,
  });

  const { data: existingEducatorReview } = useQuery({
    queryKey: ["educatorReview", testPackage?.educator_email, user?.email],
    queryFn: async () => {
      const reviews = await entities.Review.filter({
        educator_email: testPackage?.educator_email,
        reviewer_email: user.email,
        review_type: "educator",
      });
      return reviews[0] || null;
    },
    enabled: !!user?.email && !!testPackage?.educator_email && testFinished,
  });

  useEffect(() => {
    if (isReviewMode && previousResult && questions.length > 0) {
      const answersMap = {};
      questions.forEach((q) => {
        if (q.selected_answer) answersMap[q.id] = q.selected_answer;
      });
      setAnswers(answersMap);
      setTestStarted(true);
    }
  }, [isReviewMode, previousResult, questions.length]);

  useEffect(() => {
    if (attemptState && questions.length > 0 && !isReviewMode && attemptState.attempt?.status === "IN_PROGRESS") {
      const answersMap = {};
      questions.forEach((q) => {
        if (q.selected_answer) answersMap[q.id] = q.selected_answer;
      });
      setAnswers(answersMap);
      if (typeof attemptState.attempt?.remainingSeconds === "number") {
        setTimeLeft(attemptState.attempt.remainingSeconds);
      }
      // Süresiz test: localStorage'dan geçen süreyi yükle
      if (!testDetail?.isTimed && resolvedAttemptId) {
        const saved = parseInt(localStorage.getItem(`elapsed_${resolvedAttemptId}`) || '0', 10);
        setElapsedSec(isNaN(saved) ? 0 : saved);
      }
      setTestStarted(true);
      const started = attemptState.attempt?.startedAt ? new Date(attemptState.attempt.startedAt).getTime() : Date.now();
      setStartTime(started);
    }
  }, [attemptState, questions, isReviewMode]);

  // Reset solution panel when navigating between questions
  useEffect(() => {
    setShowSolution(false);
  }, [currentIndex]);

  const reportQuestionMutation = useMutation({
    mutationFn: (data) =>
      entities.Objection.create({
        attempt_id: resolvedAttemptId,
        question_id: questions[currentIndex]?.id,
        reason: (data.reason || data.description || '').trim() || `Hata türü: ${data.report_type || 'diğer'}`,
      }),
    onSuccess: () => {
      toast.success("Hata bildirimi gönderildi");
      setShowReportModal(false);
    },
  });

  const handleSubmitTestReview = async () => {
    if (testRating === 0) return;
    try {
      await entities.Review.create({
        reviewer_email: user.email,
        reviewer_name: user.username || user.full_name,
        review_type: "test",
        test_package_id: testId,
        test_package_title: testPackage?.title,
        educator_email: testPackage?.educator_email,
        educator_name: testPackage?.educator_name,
        rating: testRating,
        comment: testComment,
      });
      queryClient.invalidateQueries({ queryKey: ["testReview", testId, user?.id] });
      toast.success("Test puanınız kaydedildi!");
    } catch {
      toast.error("Bir hata oluştu!");
    }
  };

  const handleSubmitEducatorReview = async () => {
    if (educatorRating === 0) return;
    try {
      await entities.Review.create({
        reviewer_email: user.email,
        reviewer_name: user.username || user.full_name,
        review_type: "educator",
        educator_email: testPackage?.educator_email,
        educator_name: testPackage?.educator_name,
        rating: educatorRating,
        comment: educatorComment,
      });
      queryClient.invalidateQueries({ queryKey: ["educatorReview", testPackage?.educator_email, user?.email] });
      toast.success("Eğitici puanınız kaydedildi!");
    } catch {
      toast.error("Bir hata oluştu!");
    }
  };

  const queryClient = useQueryClient();

  // ─── Offline & cevap kuyruğu ─────────────────────────────────────────────

  // saveAndExit tanımı — offline auto-exit callback'i için önceden tanımla
  const handleSaveAndExit = useCallback(() => {
    toast.info("Bağlantı kesildi — ilerlemeniz kaydedildi, çıkılıyor...");
    setTimeout(() => {
      navigate(createPageUrl("MyTests"), { replace: true });
    }, 1500);
  }, [navigate]);

  // Bağlantı kesintisi yönetimi: 30 saniye bağlanamazsa otomatik çık
  const { isOffline, remainingSeconds } = useOffline({
    // Test aktifken (başladıktan sonra, bitmeden önce) offline koruması çalışsın
    enabled: testStarted && !testFinished && !isReviewMode,
    onAutoExit: handleSaveAndExit,
    autoExitSeconds: 30,
  });

  // localStorage destekli cevap kuyruğu
  const { submitAnswer: queuedSubmitAnswer, pendingCount, isFlushing, clearQueue } = useAnswerQueue(
    resolvedAttemptId ?? null,
  );

  // Attempt oluştur/başlat: POST /tests/:id/start
  const startAttemptMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/tests/${testId}/start`);
      return data; // { attemptId, remainingSec }
    },
    onSuccess: (data) => {
      setActiveAttemptId(data.attemptId);
      setTestStarted(true);
      const now = Date.now();
      setStartTime(now);
      if (test?.is_timed && data.remainingSec) {
        setTimeLeft(data.remainingSec);
      } else if (test?.is_timed && test?.duration_minutes) {
        setTimeLeft(test.duration_minutes * 60);
      }
    },
    onError: (err) => {
      const code = err?.response?.data?.code ?? err?.code;
      if (code === 'NO_PURCHASE') {
        toast.error("Bu test için satın alma kaydınız bulunamadı.");
      } else if (code === 'INVALID_DURATION') {
        toast.error("Testin süresi yapılandırılmamış. Eğiticinizle iletişime geçin.");
      } else if (code === 'NO_QUESTIONS') {
        toast.error("Bu test henüz soru içermiyor.");
      } else {
        toast.error("Test başlatılamadı. Lütfen tekrar deneyin.");
      }
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => entities.Attempt.finish(resolvedAttemptId),
    onSuccess: (data) => {
      // Geçen süreyi localStorage'a kaydet (MyTests sayfasında göstermek için)
      if (resolvedAttemptId) {
        localStorage.setItem(`elapsed_${resolvedAttemptId}`, String(elapsedSec));
      }
      setResult(data);
      // Test bitti — localStorage cevap kuyruğunu temizle
      clearQueue();
      queryClient.invalidateQueries({ queryKey: ["attemptState", resolvedAttemptId] });
      queryClient.invalidateQueries({ queryKey: ["myResults", user?.email] });
      queryClient.invalidateQueries({ queryKey: ["purchases", user?.id, testId] });
      queryClient.invalidateQueries({ queryKey: ["allTestResults", user?.id, testId] });
      queryClient.invalidateQueries({ queryKey: ["allTestProgress", user?.id, testId] });
      toast.success("Test tamamlandı!");
    },
    onError: () => {
      setTestFinished(false);
      toast.error("Test kaydedilemedi, lütfen tekrar deneyin");
    },
  });

  const handleFinish = useCallback(() => {
    if (testFinished || finishMutation.isPending) return;
    setTestFinished(true);
    finishMutation.mutate();
  }, [testFinished, finishMutation]);

  useEffect(() => {
    if (!testStarted || testFinished || isReviewMode) return;
    if (!test?.is_timed || !test?.duration_minutes) return;
    // Zaten overtime modundaysa bu timer'ı çalıştırma (ayrı overtime timer var)
    if (isOvertime) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Süre bitti: timeout() ÇAĞRILMIYOR — aday teste devam edebilir
          // Overtime modu aktifleştirilir ve ayrı sayaç başlar
          setIsOvertime(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testStarted, testFinished, test, isReviewMode, resolvedAttemptId, isOvertime]);

  // Overtime sayacı — süre dolduktan sonra kaç saniye geçtiğini gösterir
  useEffect(() => {
    if (!isOvertime || testFinished || isReviewMode) return;

    const overtimeTimer = setInterval(() => {
      setOvertimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(overtimeTimer);
  }, [isOvertime, testFinished, isReviewMode]);

  // Süresiz test elapsed sayacı — her saniye güncellenir
  useEffect(() => {
    if (!testStarted || testFinished || isReviewMode) return;
    if (test?.is_timed) return;
    const timer = setInterval(() => setElapsedSec((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [testStarted, testFinished, isReviewMode, test?.is_timed]);

  // answerMutation yerine useAnswerQueue kullanılıyor — localStorage yedekli, retry'lı

  const { testAttemptsEnabled } = useServiceStatus();

  const startTest = () => {
    if (!testAttemptsEnabled) {
      toast.warning("Test başlatma geçici olarak durdurulmuştur. Lütfen daha sonra tekrar deneyin.");
      return;
    }
    // Devam eden attempt varsa direkt başlat
    if (resolvedAttemptId) {
      setTestStarted(true);
      const now = Date.now();
      setStartTime(now);
      if (test?.is_timed && attemptState?.attempt?.remainingSeconds != null) {
        setTimeLeft(attemptState.attempt.remainingSeconds);
      } else if (test?.is_timed && test?.duration_minutes) {
        setTimeLeft(test.duration_minutes * 60);
      }
      return;
    }
    // Yeni attempt oluştur
    startAttemptMutation.mutate();
  };

  const saveAndExit = () => {
    // Süresiz testte geçen süreyi localStorage'a kaydet
    if (resolvedAttemptId && !test?.is_timed) {
      localStorage.setItem(`elapsed_${resolvedAttemptId}`, String(elapsedSec));
    }
    toast.success("İlerlemeniz kaydedildi");
    setTimeout(() => {
      navigate(createPageUrl("MyTests"), { replace: true });
    }, 1000);
  };

  const handleAnswer = (optionId) => {
    if (isReviewMode) return;
    const q = questions[currentIndex];
    if (!q) return;
    const letter = q.options?.find((o) => o.id === optionId)
      ? ["A", "B", "C", "D", "E"][q.options.findIndex((o) => o.id === optionId)]
      : null;
    // Önce React state güncelle (anlık UI geri bildirimi)
    setAnswers((prev) => ({ ...prev, [q.id]: letter }));
    // Kuyruğa ekle + API'ye gönder (offline ise kuyrukta bekler)
    queuedSubmitAnswer(q.id, optionId);
  };

  const clearAnswer = () => {
    if (isReviewMode) return;
    const q = questions[currentIndex];
    if (!q) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    // Boş bırakma — optionId undefined olarak kuyruğa ekle
    queuedSubmitAnswer(q.id, undefined);
  };

  const toggleFlag = () => {
    const qId = questions[currentIndex]?.id;
    if (!qId) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-slate-600 mb-4">Teste başlamak için giriş yapın</p>
        <Link to={loginUrl()}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">Giriş Yap</Button>
        </Link>
      </div>
    );
  }

  // Erişim kontrol edilirken yükleniyor göster
  if (testId && user && !accessDetermined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (testId && accessDetermined && !hasAccess) {
    const detailId = testDetail?.packageId ?? testId;
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-slate-600 mb-4">Bu testi henüz satın almadınız</p>
        <Link to={createPageUrl("TestDetail") + `?id=${detailId}`}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">Teste Git</Button>
        </Link>
      </div>
    );
  }

  if (isReviewMode && !previousResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sonuç Bulunamadı</h1>
          <p className="text-slate-500 mb-6">Bu test için henüz tamamlanmış bir sonuç bulunamadı.</p>
          <Link to={createPageUrl("MyTests")}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">Testlerime Dön</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayResult = resultData || result;
  const score = displayResult?.summary?.percentage ?? displayResult?.attempt?.score ?? 0;
  const correctCount = displayResult?.summary?.correct ?? 0;
  const wrongCount = displayResult?.summary?.wrong ?? 0;
  const blankCount = displayResult?.summary?.blank ?? 0;

  if (testFinished && displayResult && !isReviewMode) {
    const avgScore =
      allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + (r.score || 0), 0) / allResults.length)
        : 0;

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div
            className={cn(
              "w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6",
              score >= 70 ? "bg-emerald-100" : score >= 50 ? "bg-amber-100" : "bg-rose-100"
            )}
          >
            {score >= 70 ? (
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            ) : (
              <AlertCircle className="w-10 h-10 text-amber-600" />
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Test Tamamlandı!</h1>
          <p className="text-slate-500 mb-2">{test?.title}</p>
          <p className="text-sm text-slate-400 mb-8">{testPackage?.title}</p>

          <div className="text-6xl font-bold text-slate-900 mb-2">{score}</div>
          <p className="text-slate-500 mb-2">100 üzerinden</p>

          {allResults.length > 1 && (
            <p className="text-sm text-slate-500 mb-8">
              Diğer adayların ortalaması: <span className="font-semibold">{avgScore}</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-emerald-600">{correctCount}</p>
              <p className="text-sm text-emerald-700">Doğru</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-rose-600">{wrongCount}</p>
              <p className="text-sm text-rose-700">Yanlış</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-600">{blankCount}</p>
              <p className="text-sm text-slate-700">Boş</p>
            </div>
          </div>

          {/* Süre aşımı uyarısı — gecikmeli teslim bilgisi */}
          {displayResult?.attempt?.overtimeSeconds > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {Math.ceil(displayResult.attempt.overtimeSeconds / 60)} dakika{" "}
                  {displayResult.attempt.overtimeSeconds % 60 > 0
                    ? `${displayResult.attempt.overtimeSeconds % 60} saniye `
                    : ""}
                  gecikmeli teslim edildi
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Süre yönetimi sınav performansının önemli bir parçasıdır. Gelişim raporlarında bu bilgiyi takip edebilirsin.
                </p>
              </div>
            </div>
          )}

          {!existingTestReview && (
            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="font-semibold text-slate-900 mb-2">Bu testi değerlendir</h3>
              <p className="text-sm text-slate-600 mb-4">{testPackage?.title}</p>
              <div className="flex items-center gap-4 mb-3">
                <StarRating value={testRating} onChange={setTestRating} size="lg" />
                {testRating > 0 && (
                  <span className="text-sm text-slate-600">{testRating}/5</span>
                )}
              </div>
              <Textarea
                placeholder="Yorumunuz (opsiyonel)"
                value={testComment}
                onChange={(e) => setTestComment(e.target.value)}
                className="mb-3"
                rows={2}
              />
              <Button
                onClick={handleSubmitTestReview}
                disabled={testRating === 0}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
              >
                Testi Puanla
              </Button>
            </div>
          )}

          {!existingEducatorReview && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-semibold text-slate-900 mb-2">Eğiticiyi değerlendir</h3>
              <p className="text-sm text-slate-600 mb-4">{testPackage?.educator_name}</p>
              <div className="flex items-center gap-4 mb-3">
                <StarRating value={educatorRating} onChange={setEducatorRating} size="lg" />
                {educatorRating > 0 && (
                  <span className="text-sm text-slate-600">{educatorRating}/5</span>
                )}
              </div>
              <Textarea
                placeholder="Yorumunuz (opsiyonel)"
                value={educatorComment}
                onChange={(e) => setEducatorComment(e.target.value)}
                className="mb-3"
                rows={2}
              />
              <Button
                onClick={handleSubmitEducatorReview}
                disabled={educatorRating === 0}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Eğiticiyi Puanla
              </Button>
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                navigate(buildPageUrl("TakeTest", { id: testId, review: true }), { replace: true });
              }}
            >
              Gözden Geçir
            </Button>
            <Link to={createPageUrl("MyTests")}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">Testlerime Dön</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!testStarted && !isReviewMode) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Test-taking onboarding tour — shown before first test attempt */}
        {showTestTour && (
          <OnboardingTour
            steps={CANDIDATE_TEST_STEPS}
            onComplete={() => completeTour(TOUR_KEYS.CANDIDATE_TEST)}
            onSkip={() => completeTour(TOUR_KEYS.CANDIDATE_TEST)}
          />
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{test?.title}</h1>
          <p className="text-slate-500 mb-2">{testPackage?.title}</p>
          <p className="text-slate-500 mb-8">Teste başlamaya hazır mısın?</p>

          <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm mx-auto">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">
                {testDetail?.questions?.length ?? testDetail?.questionCount ?? 0}
              </p>
              <p className="text-sm text-slate-500">Soru</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">
                {test?.is_timed && test?.duration_minutes ? test.duration_minutes : "∞"}
              </p>
              <p className="text-sm text-slate-500">Dakika</p>
            </div>
          </div>

          {!testAttemptsEnabled ? (
            <div className="w-full max-w-xs rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-amber-800">🔧 Test başlatma bakımdadır</p>
              <p className="text-xs text-amber-600 mt-1">Lütfen daha sonra tekrar deneyin.</p>
            </div>
          ) : (() => {
            const preStartQCount = testDetail?.questions?.length ?? testDetail?.questionCount ?? 0;
            if (preStartQCount === 0) {
              return (
                <div className="w-full max-w-xs rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-rose-800">⚠️ Bu test henüz soru içermiyor</p>
                  <p className="text-xs text-rose-600 mt-1">Eğitici soruları ekleyene kadar başlatamazsınız.</p>
                </div>
              );
            }
            return (
              <Button
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={startTest}
                disabled={startAttemptMutation.isPending}
              >
                {startAttemptMutation.isPending ? "Başlatılıyor..." : "Teste Başla"}
              </Button>
            );
          })()}
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const letters = ["A", "B", "C", "D", "E"];
  const optionsForCurrent = currentQuestion?.options || [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Offline overlay — bağlantı koptuğunda tüm test arayüzünü kapatır */}
      <OfflineBanner
        isOffline={isOffline}
        remainingSeconds={remainingSeconds}
        pendingCount={pendingCount}
        isFlushing={isFlushing}
        onManualExit={saveAndExit}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {isReviewMode && (
            <Badge className="bg-indigo-100 text-indigo-700">Gözden Geçirme Modu</Badge>
          )}
          <Badge variant="outline" className="text-sm">
            {currentIndex + 1} / {questions.length}
          </Badge>
          <Progress value={progress} className="w-32 h-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnswerSheet(true)}
            className="text-indigo-600"
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            Cevaplarım
          </Button>

          {!isReviewMode && testStarted && (
            test?.is_timed && timeLeft !== null ? (
              isOvertime ? (
                /* Süre aşımı sayacı */
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 animate-pulse border border-rose-300">
                  <Clock className="w-4 h-4" />
                  <div className="flex flex-col leading-none">
                    <span className="font-mono font-bold text-sm">+{formatTime(overtimeElapsed)}</span>
                    <span className="text-xs font-normal">Süre aşıldı</span>
                  </div>
                </div>
              ) : (
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
                  timeLeft < 60
                    ? "bg-rose-100 text-rose-700 animate-pulse"
                    : timeLeft < (test?.duration_minutes || 60) * 60 * 0.1
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                )}
              >
                <Clock className="w-4 h-4" />
                <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
              </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <Clock className="w-4 h-4" />
                <span className="font-mono font-semibold">{formatTime(elapsedSec)}</span>
              </div>
            )
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isReviewMode ? (
            <Link to={createPageUrl("MyTests")}>
              <Button variant="outline">Testlerime Dön</Button>
            </Link>
          ) : (
            <>
              <Button variant="outline" onClick={saveAndExit}>
                Kaydet ve Çık
              </Button>
              <Button
                variant="outline"
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={handleFinish}
              >
                Testi Bitir
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="relative bg-white rounded-2xl border border-slate-200 p-8 mb-6">
        <QuestionCanvas
          ref={canvasRef}
          isActive={isDrawingMode}
          questionId={currentQuestion?.id}
          onHasDrawings={setHasDrawings}
        />
        <div className="relative z-20 flex items-start justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Soru {currentIndex + 1}</h2>
          <div className="flex gap-2">
            {!isReviewMode && answers[currentQuestion?.id] && (
              <Button variant="ghost" size="sm" onClick={clearAnswer} className="text-rose-500">
                <Trash2 className="w-4 h-4 mr-1" />
                Boş Bırak
              </Button>
            )}
            {isReviewMode && test?.has_solutions && (currentQuestion?.explanation || currentQuestion?.solutionMediaUrl) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSolution(!showSolution)}
                className="text-indigo-600"
              >
                <Lightbulb className="w-4 h-4 mr-1" />
                Çözüm
              </Button>
            )}
            {/* Kalem — her modda görünür */}
            {hasDrawings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => canvasRef.current?.clear()}
                className="text-slate-500"
              >
                <Eraser className="w-4 h-4 mr-1" />
                Temizle
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDrawingMode((v) => !v)}
              className={cn(isDrawingMode ? "text-indigo-600 bg-indigo-50" : "text-slate-400")}
            >
              <Pencil className="w-4 h-4 mr-1" />
              {isDrawingMode ? "Çizim Açık" : "Kalem"}
            </Button>
            {!isReviewMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                  className="text-rose-500"
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Hata Bildir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFlag}
                  className={cn(flagged.has(currentQuestion?.id) ? "text-amber-600" : "text-slate-400")}
                >
                  <Flag className="w-4 h-4 mr-1" />
                  {flagged.has(currentQuestion?.id) ? "İşaretli" : "İşaretle"}
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-slate-700 text-lg mb-8 leading-relaxed">
          {currentQuestion?.question_text}
        </p>

        {showSolution && (currentQuestion?.explanation || currentQuestion?.solutionMediaUrl) && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-6">
            <p className="text-sm font-medium text-indigo-700 mb-2">Çözüm:</p>
            {currentQuestion.explanation && (
              <p className="text-indigo-900 mb-2">{currentQuestion.explanation}</p>
            )}
            {currentQuestion.solutionMediaUrl && (
              <img
                src={currentQuestion.solutionMediaUrl}
                alt="Çözüm görseli"
                className="max-w-full rounded-lg border border-indigo-200"
              />
            )}
          </div>
        )}

        <div className="space-y-3">
          {optionsForCurrent.map((opt, idx) => {
            const letter = letters[idx];
            const optId = opt.id;
            const isSelected = answers[currentQuestion?.id] === letter;
            const isCorrect = currentQuestion?.correct_answer === letter;

            return (
              <button
                key={opt.id}
                onClick={() => handleAnswer(optId)}
                disabled={isReviewMode}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4",
                  isReviewMode && "cursor-default",
                  isReviewMode && isCorrect && "border-emerald-600 bg-emerald-50",
                  isReviewMode && isSelected && !isCorrect && "border-rose-600 bg-rose-50",
                  !isReviewMode && isSelected && "border-indigo-600 bg-indigo-50",
                  !isReviewMode && !isSelected && "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  isReviewMode && !isCorrect && !isSelected && "border-slate-200"
                )}
              >
                <span
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0",
                    isReviewMode && isCorrect && "bg-emerald-600 text-white",
                    isReviewMode && isSelected && !isCorrect && "bg-rose-600 text-white",
                    !isReviewMode && isSelected && "bg-indigo-600 text-white",
                    ((!isReviewMode && !isSelected) || (isReviewMode && !isCorrect && !isSelected)) &&
                      "bg-slate-100 text-slate-600"
                  )}
                >
                  {letter}
                </span>
                <span className="text-slate-700 flex-1">{opt.content}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isReviewMode && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  {isReviewMode && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-600" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ReportQuestionModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={(data) => reportQuestionMutation.mutate(data)}
        questionNumber={currentIndex + 1}
      />

      <Dialog open={showAnswerSheet} onOpenChange={setShowAnswerSheet}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cevaplarım</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id];
              const isCorrect = isReviewMode && userAnswer === q.correct_answer;
              const isWrong = isReviewMode && userAnswer && userAnswer !== q.correct_answer;
              const isEmpty = !userAnswer;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setShowAnswerSheet(false);
                  }}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-4",
                    idx === currentIndex && "ring-2 ring-indigo-600 ring-offset-2",
                    isReviewMode && isCorrect && "bg-emerald-50 border-emerald-200",
                    isReviewMode && isWrong && "bg-rose-50 border-rose-200",
                    isEmpty && "bg-slate-50 border-slate-200",
                    !isReviewMode && userAnswer && "bg-indigo-50 border-indigo-200",
                    !isReviewMode && !userAnswer && "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-semibold",
                      isReviewMode && isCorrect && "bg-emerald-600 text-white",
                      isReviewMode && isWrong && "bg-rose-600 text-white",
                      isEmpty && "bg-slate-200 text-slate-600",
                      !isReviewMode && userAnswer && "bg-indigo-600 text-white",
                      !isReviewMode && !userAnswer && "bg-slate-100 text-slate-600"
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">{q.question_text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        Cevabınız: <span className="font-semibold">{userAnswer || "Boş"}</span>
                      </span>
                      {isReviewMode && userAnswer && (
                        <span className="text-xs text-slate-500">
                          • Doğru: <span className="font-semibold">{q.correct_answer}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReviewMode && isCorrect && (
                      <Badge className="bg-emerald-100 text-emerald-700">Doğru</Badge>
                    )}
                    {isReviewMode && isWrong && (
                      <Badge className="bg-rose-100 text-rose-700">Yanlış</Badge>
                    )}
                    {isEmpty && (
                      <Badge variant="outline" className="text-slate-500">
                        Boş
                      </Badge>
                    )}
                    {flagged.has(q.id) && <Flag className="w-4 h-4 text-amber-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Önceki
        </Button>

        <div className="hidden md:flex gap-1 flex-wrap justify-center max-w-md">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-8 h-8 rounded-lg text-xs font-medium transition-all",
                idx === currentIndex && "ring-2 ring-indigo-600 ring-offset-2",
                answers[q.id] ? "bg-indigo-600 text-white" : flagged.has(q.id) ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <Button
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={currentIndex === questions.length - 1}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Sonraki
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
