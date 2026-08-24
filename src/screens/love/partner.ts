import { Companion } from "../../store/companions";

export type LovePersonParams = {
  companionId?: string;
  name?: string;
  fromCreation?: boolean;
  syncing?: boolean;
};

export const resolveLovePerson = ({
  companionId,
  name,
  companions,
  activeCompanion,
  chatName,
}: {
  companionId?: string;
  name?: string;
  companions: Companion[];
  activeCompanion: Companion | null;
  chatName?: string;
}) => {
  const companion =
    companions.find((item) => item.id === companionId) ??
    (companionId ? undefined : activeCompanion ?? undefined);
  return {
    companion,
    companionId: companion?.id ?? companionId,
    name: name?.trim() || chatName?.trim() || companion?.name || "Kevin",
  };
};
