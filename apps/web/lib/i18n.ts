export type Lang = "ko" | "en";

/**
 * Static UI chrome only (nav, buttons, labels) — free-text content (recipe
 * descriptions, lab notes) is a separate, on-demand translation concern.
 */
export const dictionary = {
  // nav
  navChipProgress: { ko: "칩 진행 상황", en: "Chip Progress" },
  navRecipeWiki: { ko: "레시피 위키", en: "Recipe Wiki" },
  navSubmit: { ko: "노광 신청", en: "Submit Exposure" },
  navQueue: { ko: "노광 큐", en: "Exposure Queue" },
  navLayoutConvert: { ko: "레이아웃 타입 변환", en: "Layout Conversion" },
  navMaintenance: { ko: "유지보수", en: "Maintenance" },
  navLogout: { ko: "로그아웃", en: "Log out" },
  navMenu: { ko: "메뉴", en: "Menu" },
  navDashboard: { ko: "대시보드로", en: "To dashboard" },

  // admin nav
  adminModeLabel: { ko: "유지보수 모드", en: "Maintenance mode" },
  adminProjects: { ko: "프로젝트", en: "Projects" },
  adminChipRuns: { ko: "칩 런 관리", en: "Chip Runs" },
  adminRecipeWiki: { ko: "레시피 위키", en: "Recipe Wiki" },
  adminSettings: { ko: "노광 설정", en: "Exposure Settings" },

  // common actions
  save: { ko: "저장", en: "Save" },
  saved: { ko: "저장됨", en: "Saved" },
  cancel: { ko: "취소", en: "Cancel" },
  delete: { ko: "삭제", en: "Delete" },
  add: { ko: "추가", en: "Add" },
  edit: { ko: "수정", en: "Edit" },
  close: { ko: "닫기", en: "Close" },
  confirm: { ko: "확인", en: "Confirm" },
  saving: { ko: "저장 중...", en: "Saving..." },

  // language toggle
  languageToggleLabel: { ko: "EN", en: "한국어" },

  // login page
  loginAdminHint: { ko: "유지보수 모드 — 관리자 비밀번호를 입력하세요.", en: "Maintenance mode — enter the admin password." },
  loginPasswordPlaceholder: { ko: "비밀번호", en: "Password" },
  loginError: { ko: "비밀번호가 올바르지 않습니다.", en: "Incorrect password." },
  loginChecking: { ko: "확인 중...", en: "Checking..." },
  loginButton: { ko: "로그인", en: "Log in" },

  // dashboard overview
  noChipRunsTracked: { ko: "아직 추적 중인 칩 런이 없습니다.", en: "No chip runs are being tracked yet." },
  noChipRunsInProject: { ko: "이 프로젝트에는 칩 런이 없습니다.", en: "This project has no chip runs." },
  noActiveChipRuns: { ko: "진행 중인 칩 런이 없습니다.", en: "No chip runs in progress." },
  completedChipRunsHeading: { ko: "완료된 칩 런 목록", en: "Completed Chip Runs" },
  stagesLabel: { ko: "단계", en: "steps" },
  lastUpdated: { ko: "최근 업데이트", en: "Last updated" },
  needsReviewWarning: { ko: "⚠ 검수 필요 (낮은 신뢰도)", en: "⚠ Needs review (low confidence)" },
  allProjects: { ko: "전체 프로젝트", en: "All Projects" },

  // stage types
  stageCleaning: { ko: "세정", en: "Cleaning" },
  stageResistCoating: { ko: "레지스트 코팅", en: "Resist Coating" },
  stageEbeam: { ko: "E-beam 노광", en: "E-beam Lithography" },
  stageDevelopment: { ko: "현상", en: "Development" },
  stageEtching: { ko: "식각", en: "Etching" },
  stageDeposition: { ko: "증착", en: "Deposition" },
  stageDicing: { ko: "다이싱", en: "Dicing" },
  stageDelivery: { ko: "전달", en: "Delivery" },
  stageOther: { ko: "기타", en: "Other" },

  // stage status
  statusComplete: { ko: "완료", en: "Complete" },
  statusInProgress: { ko: "진행 중", en: "In Progress" },
  statusBlocked: { ko: "중단", en: "Blocked" },
  statusSkipped: { ko: "생략", en: "Skipped" },
  statusPending: { ko: "예정", en: "Pending" },
  reasonLabel: { ko: "사유", en: "Reason" },

  // chip run detail
  chipRunBackToList: { ko: "전체 목록", en: "All Chip Runs" },
  adminEditLink: { ko: "관리자 수정", en: "Edit (admin)" },
  aliasesLabel: { ko: "다른 이름", en: "Also known as" },
  startedLabel: { ko: "시작", en: "Started" },
  needsReviewLowConfidence: {
    ko: "⚠ 자동 추출 신뢰도가 낮아 검수가 필요합니다",
    en: "⚠ Low extraction confidence — needs review",
  },

  // photo lightbox
  previousLabel: { ko: "이전", en: "Previous" },
  nextLabel: { ko: "다음", en: "Next" },

  // recipe wiki
  recipesLabel: { ko: "레시피", en: "recipes" },
  entriesLabel: { ko: "기록", en: "entries" },
  categoryListBack: { ko: "카테고리 목록", en: "Categories" },
  noRecipesYet: { ko: "아직 기록된 레시피가 없습니다.", en: "No recipes recorded yet." },
  recentLabel: { ko: "최근", en: "Recent" },
  recipeDescriptionLabel: { ko: "레시피 설명", en: "Recipe Description" },
  recipeDescriptionFixedLabel: { ko: "레시피 설명 (고정 조건)", en: "Recipe Description (fixed conditions)" },
  noUsageHistory: { ko: "아직 기록된 사용 이력이 없습니다.", en: "No usage history recorded yet." },
  usageDateLogHeading: { ko: "이용 날짜 로그", en: "Usage Date Log" },
  dateLabel: { ko: "날짜", en: "Date" },
  paramsLabel: { ko: "파라미터", en: "Parameters" },
  insufficientEtchData: {
    ko: "etch rate/selectivity를 계산할 데이터(etch_depth_nm, etch_time_s, selectivity)가 부족합니다.",
    en: "Not enough data to compute etch rate/selectivity (etch_depth_nm, etch_time_s, selectivity).",
  },
  trendHeading: { ko: "기간별 트렌드", en: "Trend Over Time" },
  etchHintText: {
    ko: "resist_thickness_nm 가 명시되어 있어야 resist strip 전/후 단차로 selectivity를 계산합니다.",
    en: "selectivity is computed from the pre/post resist-strip step height, which requires resist_thickness_nm.",
  },
  addFailed: { ko: "추가 실패", en: "Failed to add" },

  // recipe event admin
  confirmDeleteEvent: { ko: "이 이벤트 마커를 삭제할까요?", en: "Delete this event marker?" },
  eventMarkerHint: {
    ko: "이 레시피의 트렌드 그래프에 표시할 이벤트 마커 (예: 장비 셧다운) — 반투명 빨간 세로선으로 표시됩니다.",
    en: "Event markers shown on this recipe's trend chart (e.g. equipment shutdown) — rendered as a semi-transparent red vertical line.",
  },
  eventDescPlaceholder: {
    ko: "이벤트 설명 (예: 팹 공사로 장비 셧다운)",
    en: "Event description (e.g. equipment shutdown for fab construction)",
  },

  // submit page
  queueColorGreen: { ko: "이번 주 확정 가능", en: "Can be confirmed this week" },
  queueColorYellow: {
    ko: "여유 있으면 확정, 아니면 다음 주로 이월될 수 있음",
    en: "Confirmed if there's room, otherwise may roll over to next week",
  },
  queueColorOrange: {
    ko: "이번 주는 어려울 가능성 높음 (다음 주로 이월)",
    en: "Unlikely to fit this week (will roll over to next week)",
  },
  minutesUnit: { ko: "분", en: "min" },
  secondsUnit: { ko: "초", en: "sec" },
  selectEquipmentUserFirst: { ko: "장비 사용자를 먼저 선택해주세요", en: "Please select an equipment user first" },
  fileTooLarge: { ko: "파일 용량이 너무 큽니다!", en: "The file is too large!" },
  uploadFailed: { ko: "업로드 실패", en: "Upload failed" },
  equipmentUserLabel: { ko: "장비 사용자", en: "Equipment User" },
  gdsFileLabel: { ko: "GDS파일(50MB 이하)", en: "GDS file (50MB or less)" },
  chooseFileLabel: { ko: "파일 선택", en: "Choose File" },
  analyzingLayers: { ko: "레이어 분석 중...", en: "Analyzing layers..." },
  selectExposureLayers: { ko: "노광 레이어 선택", en: "Select Exposure Layers" },
  resistLabel: { ko: "레지스트", en: "Resist" },
  referenceDoseInline: { ko: "기준 dose", en: "reference dose" },
  doseLabel: {
    ko: "Dose (µC/cm²) — 필수, 레지스트 선택 시 기준값이 기본으로 입력되며 직접 수정 가능",
    en: "Dose (µC/cm²) — required; defaults to the resist's reference value but can be edited",
  },
  currentLabel: {
    ko: "E-beam Current — current가 작을수록 해상도는 좋아지지만 노광시간이 증가합니다",
    en: "E-beam Current — a smaller current improves resolution but increases exposure time",
  },
  resolutionLabel: {
    ko: "노광 해상도 — 위 조건을 적용했을 때 장비에서 허용되는 최소 픽셀 단위입니다. 이 픽셀 단위로 패턴을 쪼개어 노광하게 됩니다.",
    en: "Exposure Resolution — the minimum pixel unit the equipment allows for the above conditions. The pattern is split into these pixels for exposure.",
  },
  requesterNameLabel: { ko: "의뢰자 이름", en: "Requester Name" },
  nameLabel: { ko: "이름", en: "Name" },
  requestNotesLabel: { ko: "요청사항", en: "Request Notes" },
  requestNotesPlaceholder: {
    ko: "담당자에게 전달할 요청사항이 있다면 적어주세요 (선택)",
    en: "Any notes for the operator (optional)",
  },
  selectedAreaLabel: { ko: "선택 면적", en: "Selected Area" },
  estimatedExposureTimeLabel: { ko: "예상 노광 시간", en: "Estimated Exposure Time" },
  rangeLabel: { ko: "범위", en: "range" },
  submitting: { ko: "제출 중...", en: "Submitting..." },
  submitButton: { ko: "제출", en: "Submit" },
  confirmedTimeLabel: { ko: "확정 예상 시간", en: "Estimated Confirmed Time" },
  submitSuccessAlert: { ko: "제출되었습니다!", en: "Submitted!" },
  submitFailed: { ko: "제출 실패", en: "Submit failed" },

  // queue table
  loadingEllipsis: { ko: "불러오는 중...", en: "Loading..." },
  totalAvailableTimeLabel: { ko: "총 가용 시간", en: "Total available time" },
  availableTimeLabel: { ko: "가용 시간", en: "Available time" },
  chipLoadingTimeLabel: { ko: "칩 로딩 시간", en: "Chip loading time" },
  jobSettingsLink: { ko: "Job 설정", en: "Job Settings" },
  noSubmissionsThisWeek: { ko: "이번 주 신청 내역이 없습니다.", en: "No submissions this week." },
  confirmDeleteQueueEntry: {
    ko: "신청을 큐에서 삭제할까요?",
    en: "Delete this submission from the queue?",
  },

  // queue detail
  downloadLabel: { ko: "다운로드", en: "Download" },
  submittedDateLabel: { ko: "신청 날짜", en: "Submitted Date" },
  submitterLabel: { ko: "신청자", en: "Submitter" },
  exposureLayerLabel: { ko: "노광 레이어", en: "Exposure Layers" },
  totalAreaLabel: { ko: "총 면적", en: "Total area" },
  resistDoseLabel: { ko: "레지스트 / Dose", en: "Resist / Dose" },
  resolutionShortLabel: { ko: "노광 해상도", en: "Exposure Resolution" },
  noneLabel: { ko: "(없음)", en: "(none)" },

  // layout convert
  layoutConvertDescription: {
    ko: "Negative resist용 레이아웃을 Positive layout으로 변환해 줍니다. 파일을 선택하고 옵션을 선택해 주세요.",
    en: "Converts a layout for negative resist into a positive layout. Choose a file and set the options.",
  },
  waveguideLayerSelectLabel: {
    ko: "Waveguide layer 선택 (1개 이상 필수) — 선택한 레이어만 isolation gap만큼 buffer 처리되고, 나머지 레이어는 그대로 유지됩니다",
    en: "Select waveguide layers (at least 1 required) — only selected layers get buffered by the isolation gap; other layers stay unchanged",
  },
  isolationGapLabel: { ko: "Isolation gap (µm) — 필수", en: "Isolation gap (µm) — required" },
  converting: { ko: "변환 중...", en: "Converting..." },
  convertFailed: { ko: "변환 실패", en: "Conversion failed" },
  resultLayerDisplayLabel: { ko: "결과 레이어 표시", en: "Result Layer Display" },
  convertedSuffix: { ko: " (변환됨)", en: " (converted)" },
  keptSuffix: { ko: " (유지)", en: " (kept)" },
  downloadConvertedFile: { ko: "변환된 GDS 파일 다운로드", en: "Download Converted GDS File" },
  exampleValuePlaceholder: { ko: "예: 5", en: "e.g. 5" },

  // admin projects
  manageProjectsHeading: { ko: "프로젝트 관리", en: "Manage Projects" },
  chipRunsLabel: { ko: "칩 런", en: "chip runs" },
  addNewProjectLabel: { ko: "새 프로젝트 추가", en: "Add New Project" },
  projectNamePlaceholder: { ko: "프로젝트 이름", en: "Project name" },
  slugPlaceholder: { ko: "slug (예: new-project)", en: "slug (e.g. new-project)" },
  confirmDeleteProjectPrefix: { ko: "프로젝트를 삭제하면 소속된 칩 런", en: "Deleting this project will permanently remove its" },
  confirmDeleteProjectSuffix: {
    ko: "개와 관련 데이터가 모두 없어지고 되돌릴 수 없습니다. 정말 삭제하시겠습니까?",
    en: "chip runs and related data. This cannot be undone. Delete anyway?",
  },

  // admin chip runs
  autoCompleteHint: {
    ko: '"delivery" 또는 "completed_other" 스테이지가 완료(complete) 상태가 되면 해당 칩 런은 자동으로 완료 처리됩니다.',
    en: 'A chip run is automatically marked complete once its "delivery" or "completed_other" stage is marked complete.',
  },
  confirmDeleteChipRun: {
    ko: "을(를) 삭제하면 관련 스테이지/사진 데이터가 모두 없어지고 되돌릴 수 없습니다. 정말 삭제하시겠습니까?",
    en: "Deleting this will permanently remove its stages and photos. This cannot be undone. Delete anyway?",
  },
  addNewChipRunLabel: { ko: "새 칩 런 추가", en: "Add New Chip Run" },
  chipRunNamePlaceholder: { ko: "Run 이름 (예: 0801_EMC_run)", en: "Run name (e.g. 0801_EMC_run)" },

  // chip run admin editor
  confirmDeleteStage: {
    ko: "삭제 후 되돌릴 수 없습니다, 삭제하시겠습니까?",
    en: "This cannot be undone after deletion. Delete anyway?",
  },
  photoUploadFailed: { ko: "사진 업로드에 실패했습니다.", en: "Photo upload failed." },
  runNameLabel: { ko: "Run 이름", en: "Run Name" },
  belongsToProjectLabel: { ko: "소속 프로젝트", en: "Project" },
  needsReviewConfidencePrefix: { ko: "검수 필요", en: "Needs review" },
  markReviewedLabel: { ko: "검수 완료로 표시", en: "Mark as Reviewed" },
  dragToReorderLabel: { ko: "드래그하여 순서 변경", en: "Drag to reorder" },
  moreOptionsLabel: { ko: "더보기", en: "More options" },
  moveToOtherChipRunLabel: { ko: "다른 칩 런으로 이동", en: "Move to Another Chip Run" },
  memoPlaceholder: { ko: "메모", en: "Note" },
  startDateLabel: { ko: "시작일", en: "Start date" },
  endDateLabel: { ko: "완료일", en: "End date" },
  blockedReasonPlaceholder: { ko: "중단 사유", en: "Reason for blocking" },
  deletePhotoLabel: { ko: "사진 삭제", en: "Delete photo" },
  photoAttachLabel: { ko: "사진 첨부:", en: "Attach photo:" },
  uploadingEllipsis: { ko: "업로드 중...", en: "Uploading..." },
  memoOptionalPlaceholder: { ko: "메모 (선택)", en: "Note (optional)" },
  addStageLabel: { ko: "스테이지 추가", en: "Add Stage" },
  mergeEntireChipRunLabel: { ko: "이 칩 런 전체를 다른 칩 런으로 병합:", en: "Merge this entire chip run into another:" },
  selectEllipsis: { ko: "선택...", en: "Select..." },
  mergeConfirmButtonLabel: { ko: "병합 (이 칩 런은 삭제됨)", en: "Merge (this chip run will be deleted)" },
  selectTargetChipRunLabel: { ko: "이동할 칩 런 선택...", en: "Select target chip run..." },
  moveLabel: { ko: "이동", en: "Move" },
  manageRecipeWikiHeading: { ko: "레시피 위키 관리", en: "Manage Recipe Wiki" },
  createFailed: { ko: "생성 실패", en: "Creation failed" },
  createNewRecipeLabel: { ko: "새 레시피 생성", en: "Create New Recipe" },
  recipeNamePlaceholder: { ko: "레시피 이름 (예: SiN_DH_ZEP520A)", en: "Recipe name (e.g. SiN_DH_ZEP520A)" },
  recipeDescPlaceholder: { ko: "레시피 설명 (고정 조건, 선택)", en: "Recipe description (fixed conditions, optional)" },
  createLabel: { ko: "생성", en: "Create" },

  // recipe admin editor
  renameFailed: { ko: "이름 변경 실패", en: "Rename failed" },
  confirmDeleteRecipeEntry: { ko: "이 레시피 기록을 삭제할까요?", en: "Delete this recipe entry?" },
  recipeNameApplyAllLabel: {
    ko: "레시피 이름 (같은 이름의 모든 기록에 일괄 적용)",
    en: "Recipe Name (applies to all entries with this name)",
  },
  mergeIntoOtherRecipeLabel: { ko: "이 레시피를 다른 레시피로 병합:", en: "Merge this recipe into another:" },
  mergeButtonLabel: { ko: "병합", en: "Merge" },
  logOnlyToggleLabel: { ko: "설명만 기록", en: "Description only" },
  logOnlyToggleSuffix: {
    ko: "— 파라미터는 아래 설명란에만 적고, 각 기록은 사용 날짜만 남깁니다.",
    en: "— parameters go only in the description below; each entry just logs its date.",
  },
  recipeDescriptionFreeform: {
    ko: "레시피 설명 (이 레시피의 모든 내용 — 고정 조건과 사용 이력을 여기에 자유롭게 기록)",
    en: "Recipe Description (everything about this recipe — fixed conditions and usage history, freeform)",
  },
  recipeDescriptionFixedSteps: {
    ko: "레시피 설명 (고정 스텝/파라미터 — 여기 기록된 내용은 아래 각 기록에 반복해서 적지 않아도 됩니다)",
    en: "Recipe Description (fixed steps/parameters — no need to repeat this in each entry below)",
  },
  recipeDescriptionExamplePlaceholder: {
    ko: "예: RF power 100W, 압력 10mTorr, 가스비 CF4:O2 = 4:1, ...",
    en: "e.g. RF power 100W, pressure 10mTorr, gas ratio CF4:O2 = 4:1, ...",
  },
  deleteEntireRecipeLabel: { ko: "이 레시피 전체 삭제:", en: "Delete this entire recipe:" },
  deleteAllEntriesLabel: { ko: "전체", en: "total" },
  paramsJsonHint: { ko: "파라미터는 json 형식으로 기록해 주셔야 합니다.", en: "Parameters must be recorded in JSON format." },
  dateLogNotePlaceholder: { ko: "이 날짜 로그에 대한 비고", en: "Notes for this date's log" },
  invalidJsonAlert: { ko: "올바른 JSON 형식이 아닙니다.", en: "Not valid JSON format." },
  etchHintTextDetailed: {
    ko: "resist_thickness_nm 가 명시되어 있어야 resist strip 전/후 단차 (pre_strip_step_height, post_strip_step_height)로 resist selectivity를 자동으로 계산합니다.",
    en: "resist_thickness_nm must be specified for resist selectivity to be auto-computed from the pre/post resist-strip step height (pre_strip_step_height, post_strip_step_height).",
  },

  // admin settings
  daySun: { ko: "일", en: "Sun" },
  dayMon: { ko: "월", en: "Mon" },
  dayTue: { ko: "화", en: "Tue" },
  dayWed: { ko: "수", en: "Wed" },
  dayThu: { ko: "목", en: "Thu" },
  dayFri: { ko: "금", en: "Fri" },
  daySat: { ko: "토", en: "Sat" },
  weeklyCapacityLabel: { ko: "주당 장비 가용 시간 (시간)", en: "Weekly Equipment Availability (hours)" },
  calibrationTimeLabel: {
    ko: "Exposure calibration 시간 (분, 레이아웃당)",
    en: "Exposure Calibration Time (min, per layout)",
  },
  perLayerTimeLabel: { ko: "노광 레이어당 추가 시간 (초)", en: "Extra Time per Exposure Layer (sec)" },
  minDwellLabel: {
    ko: "최소 dwell time (ns) — 장비 스펙상 픽셀당 머무는 시간의 하한, 노광 해상도 계산에 사용됨",
    en: "Minimum Dwell Time (ns) — the equipment's floor on per-pixel dwell time, used to compute exposure resolution",
  },
  pecMarginLabel: {
    ko: "PEC 마진 (%) — dwell time 하한에 더하는 여유분, 노광 해상도 계산에 사용됨",
    en: "PEC Margin (%) — headroom added on top of the dwell time floor, used to compute exposure resolution",
  },
  cutoverDayLabel: { ko: "이월 요일", en: "Rollover Day" },
  hourLabel: { ko: "시", en: "Hour" },
  minuteFieldLabel: { ko: "분", en: "Minute" },
  saveFailed: { ko: "저장 실패", en: "Save failed" },
  runCutoverNowLabel: { ko: "지금 이월 실행", en: "Run Rollover Now" },
  equipmentUsersHeading: { ko: "장비 사용자", en: "Equipment Users" },
  dosePresetHeading: { ko: "Dose 프리셋", en: "Dose Presets" },
  ebeamCurrentPresetHeading: { ko: "E-beam Current 프리셋", en: "E-beam Current Presets" },
  cutoverFailedLabel: { ko: "실패", en: "Failed" },
  weekdaySuffix: { ko: "요일", en: "" },

  // resist dose / ebeam current preset admin (shared)
  confirmDeletePreset: {
    ko: "항목을 삭제할까요? 노광 신청 콤보박스에서 더 이상 보이지 않게 됩니다.",
    en: "will no longer appear in the exposure submission dropdown. Delete anyway?",
  },
  resistDoseHint: {
    ko: "노광 신청 페이지의 \"레지스트\" 콤보박스에 뜨는 이름과, 골랐을 때 기본값으로 표시되는 dose 값입니다. 라디오 버튼으로 표시된 항목이 노광 신청 페이지에서 처음 열었을 때 기본 선택되는 레지스트입니다.",
    en: 'The name shown in the "Resist" dropdown on the submit page, and the dose value that\'s pre-filled when selected. The radio-marked entry is the one pre-selected when the submit page first loads.',
  },
  setAsDefaultResistTitle: { ko: "기본 레지스트로 설정", en: "Set as default resist" },
  resistNamePlaceholder: { ko: "이름 (예: ZEP520A)", en: "Name (e.g. ZEP520A)" },
  ebeamCurrentHint: {
    ko: '노광 신청 페이지의 "E-beam Current" 콤보박스에 뜨는 이름과, 골랐을 때 실제 계산에 쓰이는 current(nA) 값입니다. 라디오 버튼으로 표시된 항목이 노광 신청 페이지에서 처음 열었을 때 기본 선택되는 current입니다.',
    en: 'The name shown in the "E-beam Current" dropdown on the submit page, and the current (nA) value actually used in calculations when selected. The radio-marked entry is the one pre-selected when the submit page first loads.',
  },
  setAsDefaultCurrentTitle: { ko: "기본 current로 설정", en: "Set as default current" },
  ebeamNamePlaceholder: { ko: "이름 (예: 2nA (KANC 표준))", en: "Name (e.g. 2nA (KANC standard))" },

  // equipment user admin
  updateFailed: { ko: "수정 실패", en: "Update failed" },
  confirmDeleteEquipmentUser: { ko: "장비 사용자를 삭제할까요?", en: "Delete this equipment user?" },
  deleteFailed: { ko: "삭제 실패", en: "Delete failed" },
  equipmentUserHint: {
    ko: '노광 신청 콤보박스에 뜨는 장비 사용자 목록입니다. 별명은 GDS 파일명 정리에 쓰이므로 영문/숫자/밑줄만 가능합니다. 상시 사용자는 항상 노광 큐에 표시되며, 그 외 사용자는 노광 신청에서 선택되었을 때만 큐에 나타납니다. 위쪽 "주당 장비 가용 시간"(총 가용 시간)을 바꾸면 상시 사용자들에게 자동으로 균등 재분배되고, 그 외에는 아래에서 직접 입력한 값이 그대로 유지됩니다 — 다만 전원의 가용시간 합은 항상 총 가용 시간과 같아야 저장됩니다. 로딩 시간(current 전환당)은 사용자별로 독립적으로 관리되며, 가용시간과 달리 합계 제약 없이 바로 저장됩니다.',
    en: 'The equipment users shown in the exposure submission dropdown. Aliases are used in GDS filenames, so only letters/numbers/underscores are allowed. Permanent users always show in the exposure queue; others appear only once selected in a submission. Changing "Weekly Equipment Availability" above automatically redistributes it evenly across permanent users; non-permanent users keep whatever value you enter below — but the total must always equal the weekly capacity to save. Loading time (per current switch) is managed independently per user and saves immediately, with no sum constraint.',
  },
  permanentLabel: { ko: "상시", en: "Permanent" },
  capacityHoursFieldLabel: { ko: "시간", en: "hours" },
  loadingMinutesFieldLabel: { ko: "분(로딩)", en: "min (loading)" },
  saveCapacitiesLabel: { ko: "가용시간 저장", en: "Save Availability" },
  currentSumLabel: { ko: "현재 합계", en: "Current total" },
  totalCapacityInline: { ko: "총 가용 시간", en: "total capacity" },
  sumMismatchWarning: {
    ko: "합이 맞지 않으면 저장이 거부됩니다",
    en: "save will be rejected if the total doesn't match",
  },
  equipmentUserNamePlaceholder: { ko: "이름 (예: 홍길동)", en: "Name (e.g. Jane Doe)" },
  aliasPlaceholder: { ko: "별명 (예: gildong)", en: "Alias (e.g. jdoe)" },

  // extraction menu
  extractionMenuLabel: { ko: "GPT 랩노트 자동추출(beta)", en: "GPT Lab Note Auto-Extraction (beta)" },
  extractionReviewLabel: { ko: "자동추출 검수", en: "Review Extraction" },
  extractionLogLabel: { ko: "자동추출 로그", en: "Extraction Log" },
  operatorUnlockHint: {
    ko: "서버 운영자용 기능입니다. 서버 운영자 비밀번호를 입력해주세요.",
    en: "This is a server operator feature. Please enter the server operator password.",
  },
  operatorPasswordPlaceholder: { ko: "서버 운영자 비밀번호", en: "Server operator password" },
  needsReviewChipRunsHeading: { ko: "검수 필요 칩 런", en: "Chip Runs Needing Review" },
  needsReviewRecipeEntriesHeading: { ko: "검수 필요 레시피 항목", en: "Recipe Entries Needing Review" },
  noneLabelShort: { ko: "없음", en: "None" },
  reprocessDoneLabel: { ko: "완료", en: "Done" },
  reprocessFailedLabel: { ko: "실패", en: "Failed" },
  notesCountSuffix: { ko: "개 노트", en: "notes" },
  failureCountLabel: { ko: "실패", en: "failures" },
  failureCountSuffix: { ko: "회", en: "" },
  reprocessingLabel: { ko: "재처리 중...", en: "Reprocessing..." },
  reprocessLabel: { ko: "재처리", en: "Reprocess" },

  // chip layout editor
  confirmEditModeWarning: {
    ko: "장비 사용자 전용 기능입니다. 장비 사용자가 아니라면 수정하지 말아주세요!",
    en: "This is for equipment users only. Please don't edit unless you are the equipment user!",
  },
  jobAddFailed: { ko: "job 추가 실패", en: "Failed to add job" },
  cassetteChangeFailed: { ko: "카세트 타입 변경 실패", en: "Failed to change cassette type" },
  confirmDeleteJobGeneric: { ko: "job을 삭제할까요? 되돌릴 수 없습니다.", en: "will be deleted. This cannot be undone. Delete anyway?" },
  chipAddFailed: { ko: "칩 추가 실패", en: "Failed to add chip" },
  chipUpdateFailed: { ko: "칩 수정 실패", en: "Failed to update chip" },
  confirmDeleteChipGeneric: { ko: "칩을 삭제할까요?", en: "Delete this chip?" },
  exposureJobAddFailed: { ko: "Job 추가 실패", en: "Failed to add job" },
  exposureJobUpdateFailed: { ko: "Job 수정 실패", en: "Failed to update job" },
  confirmDeleteExposureJobGeneric: {
    ko: "Job을 삭제할까요? 배치된 패턴도 함께 삭제됩니다.",
    en: "will be deleted, along with its placed patterns. Delete anyway?",
  },
  slotChangeFailed: { ko: "슬롯 변경 실패", en: "Failed to change slot" },
  placementFailed: { ko: "배치 실패", en: "Failed to place" },
  placementUpdateFailed: { ko: "배치 수정 실패", en: "Failed to update placement" },
  loadingTimeUpdateFailed: { ko: "로딩 시간 수정 실패", en: "Failed to update loading time" },
  previewGenerationFailed: { ko: "미리보기 생성 실패", en: "Failed to generate preview" },
  ebeamJobSettingsHeading: { ko: "e-beam Job 설정", en: "e-beam Job Settings" },
  loadingTimeSettingsLabel: { ko: "로딩 시간 설정", en: "Loading Time Settings" },
  viewModeLabel: { ko: "보기 모드로", en: "Switch to View" },
  addNewBatchLabel: { ko: "새 Batch 추가", en: "Add New Batch" },
  deleteBatchLabel: { ko: "Batch 삭제", en: "Delete Batch" },
  totalEstimatedExposureLabel: { ko: "총 예상 노광 시간", en: "Total Estimated Exposure Time" },
  loadingTimeLabel: { ko: "로딩 시간", en: "loading time" },
  addDeleteChipLabel: { ko: "칩 추가/삭제", en: "Add/Delete Chips" },
  mmWidthSuffix: { ko: "mm 가로", en: "mm width" },
  addChipButtonLabel: { ko: "칩 추가", en: "Add Chip" },
  currentWindowInline: { ko: "현재 window", en: "current window" },
  widthMmColumnLabel: { ko: "가로(mm)", en: "width (mm)" },
  widthLengthTitle: { ko: "가로 길이 (mm)", en: "Width (mm)" },
  noChipsLabel: { ko: "칩이 없습니다.", en: "No chips." },
  addDeleteJobLabel: { ko: "Job 추가/삭제", en: "Add/Delete Jobs" },
  addJobButtonLabel: { ko: "Job 추가", en: "Add Job" },
  noJobsLabel: { ko: "Job이 없습니다.", en: "No jobs." },
  patternListLabel: { ko: "패턴 목록", en: "Pattern List" },
  patternListHint: {
    ko: '노광 큐에서 불러온 패턴 목록입니다. "배치"를 누르면 Job에 배치가 추가됩니다.',
    en: 'Patterns loaded from the exposure queue. Click "Place" to add a placement to the job.',
  },
  patternNameColumnLabel: { ko: "패턴 이름", en: "Pattern Name" },
  slotColumnLabel: { ko: "슬롯", en: "Slot" },
  placeButtonLabel: { ko: "배치", en: "Place" },
  noPatternsThisWeekLabel: { ko: "이번 주 노광할 패턴이 없습니다.", en: "No patterns to expose this week." },
  patternPlacementLabel: { ko: "패턴 배치", en: "Pattern Placement" },
  noPlacedPatternsLabel: { ko: "배치된 패턴이 없습니다.", en: "No placed patterns." },
  windowOnlyShowsHintPrefix: { ko: "이 창에는 선택된 Job", en: "This window only shows placements from the selected job" },
  windowOnlyShowsHintSuffix: {
    ko: "의 배치만 표시됩니다. 전체 패턴 뷰는 모든 Job의 배치를 함께 보여줍니다.",
    en: ". The full pattern view shows placements from all jobs together.",
  },
  fullPatternViewLabel: { ko: "전체 패턴 뷰", en: "Full Pattern View" },
  fullPatternViewSummaryLabel: { ko: "전체 패턴 뷰 & 파라미터 요약", en: "Full Pattern View & Parameter Summary" },
  loadingTimeModalHintPrefix: {
    ko: "로딩 횟수와 calibration 시간 등을 고려하여 이번 주 노광의 적절한 로딩 시간을 입력해 주세요. 기본적으로 설정된 로딩 시간은",
    en: "Considering loading count, calibration time, etc., enter an appropriate loading time for this week's exposure. The default loading time is",
  },
  loadingTimeModalHintSuffix: {
    ko: "분 입니다. 이 로딩 시간은 노광 큐에 반영되어 레이아웃 의뢰자들이 알 수 있게 됩니다.",
    en: "min. This loading time is reflected in the exposure queue so layout requesters can see it.",
  },
  loadFailed: { ko: "불러오기 실패", en: "Failed to load" },
  backLabel: { ko: "뒤로가기", en: "Back" },
  parameterSummaryLabel: { ko: "파라미터 요약", en: "Parameter Summary" },
  slotDictionaryLabel: { ko: "슬롯 사전", en: "Slot Dictionary" },
  sizeUmColumnLabel: { ko: "크기 (µm)", en: "Size (µm)" },
  previewUnavailable: { ko: "미리보기를 표시할 수 없습니다.", en: "Preview unavailable." },
  fieldGridHint: {
    ko: "옅은 격자 한 칸이 e-beam이 한 번에 그릴 수 있는 노광 필드(1000×1000µm)입니다. 패턴이 격자 한 칸에 걸쳐 있으면 stitching error(미세 틀어짐, 최대 5~10nm)가 발생할 수 있습니다. 이를 참고하여 중요한 패턴은 한 격자 안에 들어오도록 레이아웃을 수정하는 것이 좋습니다.",
    en: "Each faint grid cell is one exposure field (1000×1000µm) the e-beam can write in a single pass. A pattern spanning a grid boundary may get a stitching error (a slight misalignment, up to 5-10nm). Keep important patterns within a single grid cell where possible.",
  },
  resetPositionLabel: { ko: "처음 위치로", en: "Reset View" },
} as const;

export type DictKey = keyof typeof dictionary;

export function translate(key: DictKey, lang: Lang): string {
  return dictionary[key][lang];
}
