function hasValue(value) {
  return value != null && value !== '';
}

export function withModelTimestamps(prediction, modelInfo) {
  if (!prediction) return prediction;
  const safeModelInfo = modelInfo && typeof modelInfo === 'object' ? modelInfo : {};

  const mainTrainedAt =
    prediction?.trained_at ||
    prediction?.model_trained_at ||
    prediction?.last_trained_at ||
    prediction?.models?.main?.trained_at ||
    prediction?.models?.main?.model_trained_at ||
    prediction?.models?.main?.last_trained_at ||
    prediction?.stats?.trained_at ||
    prediction?.metadata?.trained_at ||
    safeModelInfo?.trained_at ||
    safeModelInfo?.models?.main?.trained_at;

  const perFishTrainedAt =
    prediction?.models?.per_fish_type?.trained_at ||
    prediction?.models?.species?.trained_at ||
    prediction?.stats?.per_fish_model_trained_at ||
    prediction?.metadata?.per_fish_model_trained_at ||
    safeModelInfo?.per_fish_model_trained_at ||
    safeModelInfo?.models?.per_fish_type?.trained_at;

  const speciesMap =
    prediction?.models?.per_fish_type?.models ||
    prediction?.models?.species ||
    prediction?.fish_model_trained_at ||
    safeModelInfo?.fish_model_trained_at ||
    safeModelInfo?.models?.species ||
    {};

  return {
    ...prediction,
    trained_at: hasValue(prediction?.trained_at) ? prediction.trained_at : mainTrainedAt,
    model_trained_at: hasValue(prediction?.model_trained_at)
      ? prediction.model_trained_at
      : mainTrainedAt,
    last_trained_at: hasValue(prediction?.last_trained_at)
      ? prediction.last_trained_at
      : mainTrainedAt,
    models: {
      ...(prediction?.models || {}),
      main: {
        ...(prediction?.models?.main || {}),
        trained_at: hasValue(prediction?.models?.main?.trained_at)
          ? prediction.models.main.trained_at
          : mainTrainedAt,
      },
      per_fish_type: {
        ...(prediction?.models?.per_fish_type || {}),
        trained_at: hasValue(prediction?.models?.per_fish_type?.trained_at)
          ? prediction.models.per_fish_type.trained_at
          : perFishTrainedAt,
        models: hasValue(prediction?.models?.per_fish_type?.models)
          ? prediction.models.per_fish_type.models
          : speciesMap,
      },
    },
    metadata: {
      ...(prediction?.metadata || {}),
      trained_at: hasValue(prediction?.metadata?.trained_at)
        ? prediction.metadata.trained_at
        : mainTrainedAt,
      per_fish_model_trained_at: hasValue(prediction?.metadata?.per_fish_model_trained_at)
        ? prediction.metadata.per_fish_model_trained_at
        : perFishTrainedAt,
    },
    stats: prediction?.stats
      ? {
          ...prediction.stats,
          trained_at: hasValue(prediction?.stats?.trained_at)
            ? prediction.stats.trained_at
            : mainTrainedAt,
          per_fish_model_trained_at: hasValue(prediction?.stats?.per_fish_model_trained_at)
            ? prediction.stats.per_fish_model_trained_at
            : perFishTrainedAt,
        }
      : prediction?.stats,
  };
}
