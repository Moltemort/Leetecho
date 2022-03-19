import to from 'await-to-js';
import { StatusCodeError } from 'request-promise-native/errors';
import { transformCustomErrorToMsg } from '..';
import AppApi from '../appApi';
import { ErrorResp, SuccessResp } from '../appApi/base';
import ERROR_CODE, { getErrorCodeMessage } from '../errorCode';
import {
  GetNotesByQuestionIdResponse,
  GetQuestionDetailByTitleSlugResponse,
  GetSubmissionDetailByIdResponse,
  GetSubmissionsByQuestionSlugResponse,
  GetUserProfileQuestionsResponse,
  Question,
  Submission,
  SubmissionDetail,
  UserNote,
} from '../leetcodeServices/utils/interfaces';

import { format, toDate } from 'date-fns';

export interface GetQuestionAllInfoByTitleSlugResponse extends Question {
  lastAcceptedSubmissionDetail: SubmissionDetail & {
    time: string;
  };
  notes: UserNote[];
}

/**
 * Format timestamp to date string with 'yyyy/MM/dd H:mm' format
 * @param timestamp string | number
 * @returns string
 */
export function formatTimeStamp(timestamp: string | number) {
  return format(toDate(Number(timestamp) * 1000), 'yyyy/MM/dd H:mm');
}

export const getAllUserProfileSuccessQuestions = async (appApi: AppApi) => {
  const first = 20; // page size

  const requestOnce = async ({
    realOffset,
  }: {
    realOffset: number;
  }): Promise<GetUserProfileQuestionsResponse['userProfileQuestions']> => {
    if (!appApi) {
      throw new Error(transformCustomErrorToMsg(new ErrorResp({ code: ERROR_CODE.NOT_LOGIN })));
    }

    const [err, response] = await to(
      appApi.getUserProfileQuestions({
        skip: realOffset,
      }),
    );

    if (err) {
      throw new ErrorResp({
        code: (err as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
        message: err.message || getErrorCodeMessage(),
      });
    }

    return response as GetUserProfileQuestionsResponse['userProfileQuestions'];
  };

  const allUserProfileQuestions: GetUserProfileQuestionsResponse['userProfileQuestions']['questions'] = [];

  let curOffset = 0;

  let [err, res] = await to(requestOnce({ realOffset: curOffset }));

  if (err) {
    throw new ErrorResp({
      code: (err as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
      message: err.message || getErrorCodeMessage(),
    });
  }

  while (res?.totalNum !== allUserProfileQuestions.length) {
    const { questions = [] } = res as GetUserProfileQuestionsResponse['userProfileQuestions'];
    allUserProfileQuestions.push(...questions);
    curOffset += first;
    [err, res] = await to(requestOnce({ realOffset: curOffset }));

    if (err) {
      throw new ErrorResp({
        code: (err as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
        message: err.message || getErrorCodeMessage(),
      });
    }
  }

  allUserProfileQuestions.push(...(res?.questions ?? []));

  return {
    code: ERROR_CODE.OK,
    data: {
      questions: allUserProfileQuestions,
      totalNum: res?.totalNum ?? 0,
    },
  } as SuccessResp<GetUserProfileQuestionsResponse['userProfileQuestions']>;
};

/**
 * Get a question's detail and its submissions and notes by title slug.
 * @param appApi
 * @param titleSlug
 * @returns
 */
export const getQuestionAllInfoByTitleSlug = async (appApi: AppApi, titleSlug: string) => {
  const [questionDetailErr, questionDetail] = (await to(appApi.getProblem({ titleSlug }))) as [
    null | ErrorResp,
    GetQuestionDetailByTitleSlugResponse['question'],
  ];

  if (questionDetailErr) {
    throw new ErrorResp({
      code: (questionDetailErr as unknown as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
      message: questionDetailErr.message || getErrorCodeMessage(),
    });
  }

  const [getSubmissionErr, allSubmissionsList] = (await to(
    appApi.getSubmissionsByTitleSlug({ questionSlug: titleSlug }),
  )) as [null | ErrorResp, GetSubmissionsByQuestionSlugResponse['submissionList']];

  if (getSubmissionErr) {
    throw new ErrorResp({
      code: (getSubmissionErr as unknown as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
      message: getSubmissionErr.message || getErrorCodeMessage(),
    });
  }

  const { submissions = [] } = allSubmissionsList;

  const lastAcceptedSubmission = submissions.find((s) => s?.statusDisplay === 'Accepted') ?? ({} as Submission);

  if (Object.keys(lastAcceptedSubmission).length === 0) {
    throw new ErrorResp({
      code: ERROR_CODE.NO_AC_SUBMISSIONS,
      message: 'No accepted submission',
    });
  }

  const [getSubmissionDetailByIdErr, lastAcceptedSubmissionDetail] = (await to(
    appApi.getSubmissionDetailById({ id: lastAcceptedSubmission.id }),
  )) as [null | ErrorResp, GetSubmissionDetailByIdResponse['submissionDetail']];

  const [getNotesErr, allNotes] = (await to(
    appApi.getNotesByQuestionId({ questionId: Number(questionDetail.questionId) }),
  )) as [null | ErrorResp, GetNotesByQuestionIdResponse['noteOneTargetCommonNote']];

  if (getNotesErr) {
    throw new ErrorResp({
      code: (getNotesErr as unknown as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
      message: getNotesErr.message || getErrorCodeMessage(),
    });
  }

  if (getSubmissionDetailByIdErr) {
    throw new ErrorResp({
      code: (getSubmissionDetailByIdErr as unknown as StatusCodeError).statusCode ?? ERROR_CODE.UNKNOWN_ERROR,
      message: getSubmissionDetailByIdErr.message || getErrorCodeMessage(),
    });
  }

  const { userNotes = [] } = allNotes;

  if (userNotes.length === 0) {
    throw new ErrorResp({
      code: ERROR_CODE.NO_NOTES,
      message: 'No notes',
    });
  }

  return {
    code: ERROR_CODE.OK,
    data: {
      ...questionDetail,
      lastAcceptedSubmissionDetail: {
        ...lastAcceptedSubmissionDetail,
        time: formatTimeStamp(lastAcceptedSubmissionDetail.timestamp),
      },
      notes: userNotes,
    },
  } as SuccessResp<GetQuestionAllInfoByTitleSlugResponse>;
};
