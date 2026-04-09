interface QrPayloadInput {
  userId: string;
  accountNumber?: string | null;
  joinedDate?: Date | string | null;
}

const normalizeDate = (value?: Date | string | null): string => {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
};

export const buildUserQrPayload = (input: QrPayloadInput): string => {
  return [
    `USER:${input.userId}`,
    `ACCOUNT:${input.accountNumber ?? 'NA'}`,
    `REGISTERED:${normalizeDate(input.joinedDate)}`
  ].join('|');
};