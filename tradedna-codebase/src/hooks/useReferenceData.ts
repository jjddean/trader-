"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";

export function useReferenceData<T>(datasetName: string) {
  const datasetInfo = useQuery(api.reference_data.getLatestDataset, { name: datasetName });
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (datasetInfo) {
      const url =
        datasetInfo.storageUrl ||
        `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}${datasetInfo.storagePath}`;

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((json) => {
          setData(json);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(`Error fetching reference data (${datasetName}):`, err);
          setError(err);
          setIsLoading(false);
        });
    }
  }, [datasetInfo, datasetName]);

  return { data, isLoading, error, version: datasetInfo?.version };
}
