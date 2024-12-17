import dotenv from 'dotenv';
import axios from 'axios';

// 환경 변수 로드
dotenv.config();

// 환경 변수 확인
console.log('TESTRAIL_API_KEY:', process.env.TESTRAIL_API_KEY);
console.log('TESTRAIL_USER:', process.env.TESTRAIL_USER);
console.log('TESTRAIL_URL:', process.env.TESTRAIL_URL);
console.log('SLACK_WEBHOOK_URL:', process.env.SLACK_WEBHOOK_URL);

// Base64로 사용자 인증 정보 인코딩
const credentials = `${process.env.TESTRAIL_USER}:${process.env.TESTRAIL_API_KEY}`;
const base64Credentials = Buffer.from(credentials).toString('base64');

// Slack 메시지 전송 함수
const sendToSlack = async (testRunDetails, failedComments) => {
  try {
    const slackMessage = {
      text: `Test Run Details:\n
             Name: ${testRunDetails.name}\n
             Passed: ${testRunDetails.passed_count}\n
             Failed: ${testRunDetails.failed_count}\n
             Blocked: ${testRunDetails.blocked_count}\n
             URL: ${testRunDetails.url}\n
             ${failedComments ? `Failed Comments:\n${failedComments}` : ''}`
    };

    // Slack Webhook을 사용하여 메시지 전송
    await axios.post(process.env.SLACK_WEBHOOK_URL, slackMessage);
    console.log('Message sent to Slack');
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
};

// TestRail API에서 실행 정보 가져오기
const getTestRunDetails = async (runId) => {
  try {
    const url = `${process.env.TESTRAIL_URL}/get_run/${runId}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Test Run Details:', response.data);

    // 실패한 테스트 케이스에 대한 코멘트 가져오기
    const failedComments = await getFailedTestComments(runId);

    // Slack으로 정보 전송
    sendToSlack(response.data, failedComments);
  } catch (error) {
    console.error('Error fetching test run details:', error.response?.data || error.message);
  }
};

// TestRail API에서 실패한 테스트 케이스의 코멘트 가져오기
const getFailedTestComments = async (runId) => {
  try {
    const url = `${process.env.TESTRAIL_URL}/get_tests/${runId}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    });
    

    console.log('Response Data:', response.data); // 응답 데이터 확인

    const tests = response.data.tests || [];
    console.log('Tests:', tests); // tests 배열 확인

    const failedTests = tests.filter(test => test.status_id === 5);
    console.log('Failed Tests:', failedTests); // 실패한 테스트 확인

    if (failedTests.length > 0) {
      console.log('Failed Test Comments:', failedTests.map(test => test.comment).join('\n'));
    } else {
      console.log('No failed tests found.');
    }

    const failedComments = failedTests.map(test => test.comment).join('\n') || 'No failed test comments.';
    return failedComments;
  } catch (error) {
    console.error('Error fetching failed test comments:', error.response?.data || error.message);
    return 'Error fetching failed test comments.';
  }
};

// TestRail API에서 가장 최근 테스트 실행의 runId 가져오기
const getLatestTestRunId = async () => {
  try {
    // get_runs API를 사용하여 프로젝트의 실행 목록을 가져옵니다.
    const url = `${process.env.TESTRAIL_URL}/get_runs/5`;  // projectId 5
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    });

    // 가장 최근 실행의 runId를 가져옵니다.
    const latestRunId = response.data.runs[0].id;  // 최신 실행의 runId 가져오기
    console.log('Latest Run ID:', latestRunId);

    return latestRunId;
  } catch (error) {
    console.error('Error fetching latest test run ID:', error.response?.data || error.message);
  }
};


// 환경 변수로부터 사용자 정보 가져오기
const testrailUser = process.env.TESTRAIL_USER; // TestRail 사용자 이름 (이메일)
const testrailPassword = process.env.TESTRAIL_API_KEY; // TestRail API Key
const testrailUrl = process.env.TESTRAIL_URL; // TestRail URL

// 사용자 이름과 API 키를 Base64로 인코딩
const auth = Buffer.from(`${testrailUser}:${testrailPassword}`).toString('base64');
console.log(`Encoded Authorization: Basic ${auth}`);


// HTTP 요청 옵션 정의
const options = {
    method: 'GET',
    url: `${testrailUrl}/get_runs/5`,
    headers: {
        'Authorization': `Basic ${auth}`, // Authorization 헤더 추가
        'Content-Type: application/json'
    }
};

// 요청 실행
axios(options)
    .then(response => {
        console.log('Response:', response.data);
    })
    .catch(error => {
        console.error('Error fetching latest test run ID:', error.response ? error.response.data : error.message);
    });

// 자동으로 가장 최신 runId를 가져와서 테스트 실행 정보 호출
const fetchAndNotifyTestRun = async () => {
  try {
    const runId = await getLatestTestRunId();
    if (runId) {
      await getTestRunDetails(runId);
    }
  } catch (error) {
    console.error('Error during TestRail integration:', error.message);
    // 예외 발생 시 기본 Slack 메시지 생성
    fs.writeFileSync('slack_message.txt', 'TestRail integration failed due to authentication error.');
  }
};

// 자동 실행
fetchAndNotifyTestRun();
