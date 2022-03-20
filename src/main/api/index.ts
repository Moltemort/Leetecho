import to from 'await-to-js';
import path from 'path';
import { app, ipcMain } from 'electron';
import fileTools from '../tools/file/file';
import AppApi from './appApi';
import baseHandler, { ErrorResp, SuccessResp } from './appApi/base';
import {
  CreateTemplateRequest,
  CreateTemplateResponse,
  ReadUserTemplateRequest,
  ReadUserTemplateResponse,
  SaveTemplateRequest,
  SaveTemplateResponse,
} from './appApi/idl/io';
import {
  GetAllProblemsResponse,
  GetNotesByQuestionIdRequest,
  GetProblemResponse,
  GetProblemsRequest,
  GetProblemsResponse,
  GetQuestionDetailByTitleSlugRequest,
  GetSubmissionDetailByIdRequest,
  GetSubmissionsByQuestionSlugRequest,
  GetSubmissionsByQuestionSlugResponse,
} from './appApi/idl/problems';
import { GetAllTagsResponse } from './appApi/idl/tags';
import { LoginReq, LoginResp, LogoutResp } from './appApi/idl/user';
import ERROR_CODE, { getErrorCodeMessage } from './errorCode';
import {
  Difficulty,
  EndPoint,
  GetNotesByQuestionIdResponse,
  GetUserProgressResponse,
  GetUserStatusResponse,
  Question,
} from './leetcodeServices/utils/interfaces';
import { formatLeetechoSyntax } from '../tools';
import {
  getAllUserProfileSuccessQuestions,
  getQuestionAllInfoByTitleSlug,
  GetQuestionAllInfoByTitleSlugResponse,
  sleep,
} from './services/publishServices';

import Handlebars from 'handlebars';

import { format, toDate } from 'date-fns';

const isDev = process.env.NODE_ENV === 'development';

Handlebars.registerHelper('ifCN', function (endPoint, options) {
  if (endPoint === 'CN') {
    return options.fn();
  } else {
    return '';
  }
});

let appApi: AppApi | null = null;

/** V8's serialization algorithm does not include custom properties on errors, see: https://github.com/electron/electron/issues/24427 */
export const transformCustomErrorToMsg: (err: Error | ErrorResp) => string = (err) =>
  `${(err as ErrorResp).code ?? ERROR_CODE.UNKNOWN_ERROR} ${err.message ?? getErrorCodeMessage()}`;

ipcMain.handle('login', async (_, params: LoginReq) => {
  const [err, res] = await to(baseHandler(AppApi.login(params)));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }

  appApi = res?.data ?? null;
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: {},
  } as LoginResp;
});

ipcMain.handle('logout', async () => {
  if (!appApi) {
    return {
      code: ERROR_CODE.OK,
      data: {},
    };
  }

  appApi = null;

  return {
    code: ERROR_CODE.OK,
    data: {},
  } as LogoutResp;
});

ipcMain.handle('getAllProblems', async () => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }

  const [err, res] = await to(baseHandler(appApi.getAllProblems()));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }

  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as GetAllProblemsResponse;
});

ipcMain.handle('getAllTags', async () => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }

  const [err, res] = await to(baseHandler(appApi.getAllTags()));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }

  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as GetAllTagsResponse;
});

ipcMain.handle('getProblems', async (_, params: GetProblemsRequest) => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }
  const [err, res] = await to(baseHandler(appApi.getProblems(params)));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as GetProblemsResponse;
});

ipcMain.handle('getProblem', async (_, params: GetQuestionDetailByTitleSlugRequest) => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }
  const [err, res] = await to(baseHandler(appApi.getProblem(params)));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as GetProblemResponse;
});

ipcMain.handle('getSubmissionsByTitleSlug', async (_, params: GetSubmissionsByQuestionSlugRequest) => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }
  const [err, res] = await to(baseHandler(appApi.getSubmissionsByTitleSlug(params)));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as GetSubmissionsByQuestionSlugResponse;
});

ipcMain.handle('getNotesByQuestionId', async (_, params: GetNotesByQuestionIdRequest) => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }
  const [err, res] = await to(baseHandler(appApi.getNotesByQuestionId(params)));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as SuccessResp<GetNotesByQuestionIdResponse>;
});

ipcMain.handle('getSubmissionDetailById', async (_, params: GetSubmissionDetailByIdRequest) => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }
  const [err, res] = await to(baseHandler(appApi.getSubmissionDetailById(params)));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as SuccessResp<GetNotesByQuestionIdResponse>;
});

ipcMain.handle('getUserStatus', async () => {
  if (!appApi) {
    throw new ErrorResp({ code: ERROR_CODE.NOT_LOGIN });
  }
  const [err, res] = await to(baseHandler(appApi.getUserStatus()));

  if (err) {
    throw new Error(transformCustomErrorToMsg(err));
  }
  return {
    code: res?.code ?? ERROR_CODE.OK,
    data: res?.data ?? {},
  } as SuccessResp<GetUserStatusResponse['userStatus']>;
});

ipcMain.handle('readUserTemplate', async (_, params: ReadUserTemplateRequest) => {
  const {
    userInfo: { usrName = '', endPoint = 'CN' },
  } = params;

  const delimiter = path.sep;

  const templatePath = `${app.getPath(
    'documents',
  )}${delimiter}Leetecho Files${delimiter}${endPoint}${delimiter}${usrName}`;

  const coverTemplate = fileTools.readFile(`${templatePath}/coverTemplate.md`);
  const problemTemplate = fileTools.readFile(`${templatePath}/problemTemplate.md`);

  const res = [
    {
      fileNameWithFileType: 'coverTemplate.md',
      content: coverTemplate,
    },
    {
      fileNameWithFileType: 'problemTemplate.md',
      content: problemTemplate,
    },
  ];

  return {
    code: ERROR_CODE.OK,
    data: res,
  } as SuccessResp<ReadUserTemplateResponse>;
});

ipcMain.handle('createTemplate', async (_, params: CreateTemplateRequest) => {
  const {
    userInfo: { usrName = '', endPoint = 'CN' },
  } = params;

  const delimiter = path.sep;

  const templatePath = `${app.getPath(
    'documents',
  )}${delimiter}Leetecho Files${delimiter}${endPoint}${delimiter}${usrName}`;

  const [_importTemplateErr, res] = await to(
    Promise.all([
      import('../../../assets/defaultTemplates/coverTemplate.md'),
      import('../../../assets/defaultTemplates/problemTemplate.md'),
    ]),
  );

  const coverTemplateModule = res?.[0] || { default: '' };
  const problemTemplateModule = res?.[1] || { default: '' };

  const coverTemplateContent = coverTemplateModule.default;
  const problemTemplateContent = problemTemplateModule.default;

  fileTools.createFilesInDir(templatePath, [
    {
      fileNameWithFileType: 'coverTemplate.md',
      content: coverTemplateContent as string,
    },
    {
      fileNameWithFileType: 'problemTemplate.md',
      content: problemTemplateContent as string,
    },
  ]);

  return {
    code: ERROR_CODE.OK,
    data: {},
  } as SuccessResp<CreateTemplateResponse>;
});

ipcMain.handle('saveTemplate', async (_, params: SaveTemplateRequest) => {
  const {
    userInfo: { usrName = '', endPoint = 'CN' },
    type,
    content,
  } = params;

  const delimiter = path.sep;

  const templatePath = `${app.getPath(
    'documents',
  )}${delimiter}Leetecho Files${delimiter}${endPoint}${delimiter}${usrName}${delimiter}${type}Template.md`;

  fileTools.writeFile(templatePath, content);

  return {
    code: ERROR_CODE.OK,
    data: {},
  } as SuccessResp<SaveTemplateResponse>;
});

ipcMain.handle('getDefaultTemplates', async (_) => {
  const [importTemplateErr, res] = await to(
    Promise.all([
      import('../../../assets/defaultTemplates/coverTemplate.md'),
      import('../../../assets/defaultTemplates/problemTemplate.md'),
    ]),
  );

  if (importTemplateErr) {
    throw new Error(transformCustomErrorToMsg(importTemplateErr));
  }

  const coverTemplateModule = res?.[0] || { default: '' };
  const problemTemplateModule = res?.[1] || { default: '' };

  const coverTemplateContent = coverTemplateModule.default;
  const problemTemplateContent = problemTemplateModule.default;

  return {
    code: ERROR_CODE.OK,
    data: {
      coverTemplateContent,
      problemTemplateContent,
    },
  } as SuccessResp<{
    coverTemplateContent: typeof import('*.md');
    problemTemplateContent: typeof import('*.md');
  }>;
});

ipcMain.handle(
  'publish',
  async (
    _,
    params: {
      userSlug: string;
      userName: string;
      endPoint: EndPoint;
    },
  ) => {
    if (!appApi) {
      throw new Error(transformCustomErrorToMsg(new ErrorResp({ code: ERROR_CODE.NOT_LOGIN })));
    }

    const userCoverTemplateVariables: {
      [key: string]: any;
    } = {};

    const { userSlug = '', userName = '', endPoint = 'CN' } = params;

    const outputPath = `${app.getPath('documents')}${path.sep}Leetecho Files${path.sep}CN${path.sep}${userName}${
      path.sep
    }outputs`;

    fileTools.mkdirPath(`${outputPath}${path.sep}imgs`);

    fileTools.mkdirPath(`${outputPath}${path.sep}problems`);

    fileTools.copyFiles(
      isDev
        ? path.join(__dirname, '../../assets/defaultTemplates/imgs')
        : path.join(process.resourcesPath, 'assets', 'defaultTemplates', 'imgs'),
      `${outputPath}${path.sep}imgs`,
    );

    const [getUserProgressErr, getUserProgressRes] = (await to(appApi.getUserProgress({ userSlug }))) as [
      null | ErrorResp,
      GetUserProgressResponse,
    ];

    if (getUserProgressErr) {
      throw new Error(transformCustomErrorToMsg(getUserProgressErr));
    }

    const profile: {
      numSolved: number;
      numTotal: number;
      acEasy: number;
      acMedium: number;
      acHard: number;
      userName: string;
      endPoint: 'CN';
    } = {
      numSolved:
        getUserProgressRes?.userProfileUserQuestionProgress?.numAcceptedQuestions?.reduce?.((acc, cur) => {
          const { count = 0 } = cur;
          return acc + count;
        }, 0) || 0,
      numTotal:
        Object.entries(getUserProgressRes?.userProfileUserQuestionProgress)?.reduce?.((acc, [_, v]) => {
          return (
            (
              v as Array<{
                difficulty: Difficulty;
                count: number;
              }>
            ).reduce((innerAcc, innerCur) => {
              const { count = 0 } = innerCur;
              return innerAcc + count;
            }, 0) + acc
          );
        }, 0) || 0,
      acEasy:
        getUserProgressRes?.userProfileUserQuestionProgress?.numAcceptedQuestions?.find((i) => i?.difficulty === 'EASY')
          ?.count || 0,
      acMedium:
        getUserProgressRes?.userProfileUserQuestionProgress?.numAcceptedQuestions?.find(
          (i) => i?.difficulty === 'MEDIUM',
        )?.count || 0,
      acHard:
        getUserProgressRes?.userProfileUserQuestionProgress?.numAcceptedQuestions?.find((i) => i?.difficulty === 'HARD')
          ?.count || 0,
      userName: userSlug,
      endPoint: 'CN',
    };

    userCoverTemplateVariables.profile = profile;

    userCoverTemplateVariables.updateTime = format(new Date(), 'yyyy/MM/dd H:mm');

    console.log('%c 1 >>>', 'background: yellow; color: blue', 1);

    let userCover = formatLeetechoSyntax(
      fileTools.readFile(
        `${app.getPath('documents')}${path.sep}Leetecho Files${path.sep}CN${path.sep}${userName}${
          path.sep
        }coverTemplate.md`,
      ),
    );

    const userProblem = formatLeetechoSyntax(
      fileTools.readFile(
        `${app.getPath('documents')}${path.sep}Leetecho Files${path.sep}CN${path.sep}${userName}${
          path.sep
        }problemTemplate.md`,
      ),
    );

    console.log('%c 2 >>>', 'background: yellow; color: blue', 2);

    if (!userCover || !userProblem) {
      throw new Error('Template is empty');
    }

    console.log('%c 3 >>>', 'background: yellow; color: blue', 3);

    const [getAllUserProfileSuccessQuestionsErr, getAllUserProfileQuestionsRes] = await to(
      getAllUserProfileSuccessQuestions(appApi),
    );

    console.log('%c 4 >>>', 'background: yellow; color: blue', 4);

    if (getAllUserProfileSuccessQuestionsErr) {
      throw new Error(transformCustomErrorToMsg(getAllUserProfileSuccessQuestionsErr));
    }

    console.log('%c 5 >>>', 'background: yellow; color: blue', 5);

    const {
      data: { questions = [] },
    } = getAllUserProfileQuestionsRes;

    userCover = userCover.replace(
      ':allProblems{}',
      questions
        .map(
          (question) =>
            // eslint-disable-next-line max-len
            `| ${question.frontendId ?? (question.questionFrontendId || '')} | [${question.title}](problems/${
              question.titleSlug
            }) | [${question.translatedTitle}](problems/${question.titleSlug}) | ![](imgs/${
              question.difficulty
            }.png) | `,
        )
        .join('\n'),
    );

    console.log('%c 6 >>>', 'background: yellow; color: blue', 6);

    const handleQuestion = async (q: Question) => {
      const [err, res] = (await to(
        getQuestionAllInfoByTitleSlug({ appApi: appApi as AppApi, titleSlug: q.titleSlug }),
      )) as [null | ErrorResp, SuccessResp<GetQuestionAllInfoByTitleSlugResponse>];
      if (err) {
        throw new Error(transformCustomErrorToMsg(err));
      }
      console.log('%c handleQuestionResData >>>', 'background: yellow; color: blue', res.data);

      const { data } = res;
      const userProblemTemp = Handlebars.compile(userProblem);
      const problemContent = userProblemTemp(data);
      fileTools.createFilesInDirForced(path.join(outputPath, 'problems'), [
        {
          fileNameWithFileType: `${data.titleSlug}.md`,
          content: problemContent,
        },
      ]);
    };

    for (let i = 0; i < questions.length; i++) {
      const [err, _] = await to(handleQuestion(questions[i]));
      if (err) {
        throw new Error(transformCustomErrorToMsg(err));
      }
    }

    console.log('%c 7 >>>', 'background: yellow; color: blue', 7);

    const handleBarCoverTemplate = Handlebars.compile(userCover);

    console.log('%c 8 >>>', 'background: yellow; color: blue', 8);

    const coverContent = handleBarCoverTemplate(userCoverTemplateVariables);

    console.log('%c 9 >>>', 'background: yellow; color: blue', 9);

    console.log('%c 10 >>>', 'background: yellow; color: blue', 10);

    fileTools.createFilesInDirForced(outputPath, [
      {
        fileNameWithFileType: 'readme.md',
        content: coverContent,
      },
    ]);

    console.log('%c 10 >>>', 'background: yellow; color: blue', 10);
  },
  /** TODO: continue to finish remote github repo pushing function*/
);
